"use strict";

var async = require("async"),
	path = require("path"),
	_ = require("underscore"),
	libxmljs = require("libxmljs");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var processElement, transactionElement, errMsg,
		params = variableContainer["_params"],
		processElements = [],
		event = params["_event"];
	
	if(typeof event === "undefined" || event === null || event === ""){
		processElements = xmlDoc.find("./processList/*");
	}else{
		var events = event.split(",");
		events = _.reject(events, function(value){
			processElement = xmlDoc.get("./processList/process[@id=\"" + value + "\"]");
			transactionElement = xmlDoc.get("./processList/transaction[@id=\"" + value + "\"]");
			if(!processElement && !transactionElement){
				return false;
			}
			if(processElement){
				processElements.push(processElement);
			}
			if(transactionElement){
				processElements.push(transactionElement);
			}
			return true;
		});

		if(events.length > 0){
			errMsg = _.reduce(events, function(memo, value){
				return (memo === "") ? (memo + value) : (memo + "," + value);
			}, "");
			process.nextTick(function(){
				next({ message: "process or transaction does not exist: " + errMsg });
			});
			return;
		}
	}
	
	async.eachSeries(
		processElements,
		function(item , callback){
			var elementName = item.name();
			if(elementName === "process"){
				handleProcessElement(item, variableContainer, configuration, compiler, function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				});
			}else if(elementName === "variable"){
				handleVariableElement(item, variableContainer, compiler, function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				});
			}else if(elementName === "for-each"){
				handleForEachElement(item, variableContainer, configuration, compiler, function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				});
			}else if(elementName === "if"){
				handleConditionElement(item, variableContainer, configuration, compiler, function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				});
			}else if(elementName === "transaction"){
				handleTransactionElement(item, variableContainer, configuration, compiler, function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				});
			}else{
				callback(null);
			}
		}, function(err){
			if(err){
				next(err);
				return;	
			}
			next(null, xmlDoc, variableContainer, configuration, compiler);
		}
	);
};

function handleTransactionElement(item, variableContainer, configuration, compiler, callback){
	var trans,
		config = configuration.get(),
		driver = config["driver"],
		idAttr = item.attr("id"),
		dataSourceAttr = item.attr("data_source"),
		isolationLevelAttr = item.attr("isolation_level"),
		isolationLevel = (!isolationLevelAttr) ? "READ_COMMITTED" : isolationLevelAttr.value();

	if(!idAttr || !dataSourceAttr){
		process.nextTick(function(){
			callback({ message: "<transaction> element must have @id and @data_source attribute." });
		});
		return;
	}

	async.waterfall(
		[
			(getConnection).bind({ dataSource: dataSourceAttr, configuration: configuration }),
			function(connection, next){
				driver.transaction(connection, function(err, txn){
					if(err){
						next(err);
						return;
					}
					trans = txn;
					driver.begin(trans, { isolationLevel: isolationLevel }, function(err){
						if(err){
							process.nextTick(function(){
								next(err);
							});
							return;
						}
						variableContainer[idAttr.value()] = trans;
						next(null, item);
					});
				});
			},
			injectTransaction,
			function(transactionElement, next){
				var processElements = transactionElement.find("./*");
				runForEachIteration(processElements, variableContainer, configuration, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}
		],
		function(err){
			if(err){
				if(!trans){
					process.nextTick(function(){
						callback(err);
					});
					return;
				}
				driver.rollback(trans, function(rollbackErr){
					if(rollbackErr){
						process.nextTick(function(){
							callback(rollbackErr);
						});
						return;
					}
					process.nextTick(function(){
						callback(err);
					});
				});
				return;
			}

			driver.commit(trans, function(commitErr){
				if(commitErr){
					process.nextTick(function(){
						callback(commitErr);
					});
					return;
				}
				process.nextTick(function(){
					callback(null);
				});
			});
		}
	);
}

function injectTransaction(transactionElement, next){
	var processElements,
		idAttr = transactionElement.attr("id"),
		id = idAttr.value();
	processElements = transactionElement.find(".//process[@type=\"sql\"]");
	async.eachSeries(
		processElements,
		function(processElement, callback){
			processElement.attr({ "_transaction": id });
			process.nextTick(function(){
				callback(null);
			});
		},
		function(err){
			if(err){
				process.nextTick(function(){
					next(err);
				});
				return;
			}
			next(null, transactionElement);
		}
	);
}

function handleForEachElement(item, variableContainer, configuration, compiler, callback){
	var data, processElements,
		variableAttr = item.attr("var"),
		itemsAttr = item.attr("items");
	if(!variableAttr || !itemsAttr){
		process.nextTick(function(){
			callback({ message: "<for-each> element must have @var and @items attribute." });
		});
		return;
	}
	data = variableContainer[itemsAttr.value()];
	if(!_.isArray(data)){
		process.nextTick(function(){
			callback({ message: "value of @items must be array" });
		});
		return;
	}
	injectToArrayAttribute(item);
	variableContainer["$context"] = {};
	processElements = item.find("./*");

	async.eachSeries(
		data,
		function(obj, next){
			variableContainer[variableAttr.value()] = obj;
			runForEachIteration(processElements, variableContainer, configuration, compiler, function(err){
				if(err){
					next(err);
					return;
				}
				next(null);
			});
		},
		function(err){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			delete variableContainer[variableAttr.value()];
			delete variableContainer["$context"];
			process.nextTick(function(){
				callback(null);
			});
		}
	);
}

function injectToArrayAttribute(forEachElement){
	var processElements = forEachElement.find(".//process");

	_.each(processElements, function(processElement){
		processElement.attr({ _toArray: true });
	});
}

function runForEachIteration(processElements, variableContainer, configuration, compiler, callback){
	var config = configuration.get(),
		logger = config["logger"];
	async.eachSeries(
		processElements,
		function(processElement, next){
			var elementName = processElement.name(),
				cloneXmlDoc = libxmljs.parseXmlString(processElement.toString()),
				cloneRoot = cloneXmlDoc.root();
			if(elementName === "process"){
				handleProcessElement(cloneRoot, variableContainer, configuration, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}else if(elementName === "variable"){
				handleVariableElement(cloneRoot, variableContainer, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}else if(elementName === "if"){
				handleConditionElement(cloneRoot, variableContainer, configuration, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}else if(elementName === "for-each"){
				handleForEachElement(cloneRoot, variableContainer, configuration, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}else{
				logger.error("elementName not ready : " + elementName);
			}

		},
		function(err){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			process.nextTick(function(){
				callback(null);
			});
		}
	);
}

function handleConditionElement(item, variableContainer, configuration, compiler, callback){
	var paramValue, processElements,
		testAttr = item.attr("test");
	paramValue = testAttr.value();

	compiler.compile(paramValue, variableContainer, function(err, res){
		if(err){
			process.nextTick(function(){
				callback(err);
			});
			return;
		}
		testAttr.value(res);
		if(res === true || res === "true"){
			processElements = item.find("./*");
			runForEachIteration(processElements, variableContainer, configuration, compiler, function(err){
				if(err){
					callback(err);
					return;
				}
				callback(null);
			});
		}else{
			callback(null);
		}
	});
}

function handleVariableElement(variable, variableContainer, compiler, callback){
	var variableName = variable.attr("name"),
			variableValue = variable.attr("value");
	if(!variableName || !variableValue){
		process.nextTick(function(){
			callback({ message: "variable element must set @name and @value attribute." });
		});
		return;
	}

	compiler.compile(variableValue.value(), variableContainer, function(err, res){
		if(err){
			process.nextTick(function(){
				callback(err);
			});
			return;
		}
		variableValue.value("");
		setVariableContainer(variableContainer, variableName.value(), res, variable.attr("_includes"), variable.attr("_scope"));
		process.nextTick(function(){
			callback(null);
		});
	});
}

function handleProcessElement(item, variableContainer, configuration, compiler, callback){
	var params = item.find("./param");
	async.each(
		params,
		function(param, next){
			var paramValueAttr = param.attr("value"),
				paramValue = paramValueAttr.value();

			compiler.compile(paramValue, variableContainer, function(err, res){
				if(err){
					next(err);
					return;
				}
				paramValueAttr.value(res);
				next(null);
			});
		},
		function (err) {
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			runProcess(item, variableContainer, configuration, compiler, function(err){
				if(err){
					process.nextTick(function(){
						callback(err);
					});
					return;
				}

				process.nextTick(function(){
					callback(null);
				});
			});
		}
	);
}

function runProcess(ps, variableContainer, configuration, compiler, callback){
	var id = ps.attr("id"),
		type = ps.attr("type");
	if(!type || !id){
		process.nextTick(function(){
			callback({ message: "<process> element must have @id and @type attribute." });
		});
		return;
	}
	if(type.value() === "sql"){
		executeSQLProcess(ps, variableContainer, configuration, compiler, function(err, data){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			setVariableContainer(variableContainer, id.value(), data, ps.attr("_include"), ps.attr("_scope"), ps.attr("_toArray"));
			callback(null);
		});
	}else if(type.value() === "service"){
		executeServiceProcess(ps, variableContainer, configuration, compiler, function(err, data){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			setVariableContainer(variableContainer, id.value(), data, ps.attr("_include"), ps.attr("_scope"), ps.attr("_toArray"));
			callback(null);
		});
	}else{
		process.nextTick(function(){
			callback({ message: "Unknow type of process." });
		});
	}
}

function executeServiceProcess(ps, variableContainer, configuration, compiler, callback){
	var params, serviceName, serviceOperation, serviceObj,
		config = configuration.get(),
		paramsObj = {},
		serviceHome = config["serviceHome"],
		serviceElement = ps.get("./service");
	if(!serviceElement){
		process.nextTick(function(){
			callback({ message: "service type dataset must have <service> child element." });
		});
		return;
	}
	serviceName = serviceElement.attr("name");
	serviceOperation = serviceElement.attr("operation");
	if(!serviceName || !serviceOperation){
		process.nextTick(function(){
			callback({ message: "<service> element must have @name and @operation attribute." });
		});
		return;
	}
	try{
		serviceObj = require(path.join(serviceHome, serviceName.value()));
		params = ps.find("./param");

		async.each(
			params,
			function(param, next){
				compiler.compile(param.attr("value").value(), variableContainer, function(err, res){
					if(err){
						process.nextTick(function(){
							next(err);
						});
						return;
					}
					paramsObj[param.attr("name").value()] = res;
					next(null);
				});
			},
			function(err){
				if(err){
					process.nextTick(function(){
						callback(err);
					});
					return;
				}
				serviceObj[serviceOperation.value()](paramsObj, variableContainer, configuration, function(err, data){
					if(err){
						process.nextTick(function(){
							callback(err);
						});
						return;
					}
					process.nextTick(function(){
						callback(null, data);
					});
				});
			}
		);
	}catch(err){
		process.nextTick(function(){
			callback(err);
		});	
	}
}

function executeSQLProcess(ps, variableContainer, configuration, compiler, callback){
	var multiple,
		sqlElement = ps.get("./sql"),
		dataSource = ps.attr("data_source"),
		transaction = ps.attr("_transaction"),
		multipleRecordsets = false;

	if(!sqlElement){
		process.nextTick(function(){
			callback({ message: "sql type process must have <sql> child element" });
		});
		return;
	}

	if(!dataSource && !transaction){
		process.nextTick(function(){
			callback({ message: "sql type process must have @data_source attribute or be a child element of the <transaction> element" });
		});
		return;
	}

	multiple = sqlElement.attr("multiple");
	if(multiple && multiple.value() === "true"){
		multipleRecordsets = true;
	}

	compiler.replace(sqlElement.text(), variableContainer, function(err, sql){
		if(err){
			process.nextTick(function(){
				callback(err);
			});
			return;
		}

		async.waterfall(
			[
				(getConnection).bind({ transaction: transaction, dataSource: dataSource, variableContainer: variableContainer, configuration: configuration }),
				(executeSQL).bind({ ps: ps, sql: sql , multipleRecordsets: multipleRecordsets, configuration: configuration })
			],
			function(err, data){
				if(err){
					process.nextTick(function(){
						callback(err);
					});
					return;
				}
				process.nextTick(function(){
					callback(null, data);
				});
			}
		);
	});
}

function executeSQL(connection, next){
	var configuration = this.configuration.get(),
		multipleRecordsets = this.multipleRecordsets,
		driver = configuration["driver"],
		logger = configuration["logger"],
		ps = this.ps,
		params = ps.find("./param"),
		paramsObj = {},
		sql = this.sql;

	async.each(
		params,
		function(param, cb){
			var obj = {},
				paramName = param.attr("name"),
				paramValue = param.attr("value"),
				attrs = param.attrs();
			if(!paramName || !paramValue){
				cb({ message: "param elemet must have @name and @value attributes" });
				return;
			}

			async.each(
				attrs,
				function(attr, callback){
					obj[attr.name()] = attr.value();
					callback(null);
				},
				function(err){
					if(err){
						cb(err);
						return;
					}
					paramsObj[paramName.value()] = obj;
					logger.info(paramName.value() + " = " + paramValue.value());
					cb(null);
				}
			);
		},
		function(err){
			var opts = { multiple: false };
			if(err){
				next({ message: "param elemet must have @name and @value attributes" });
				return;
			}

			if(multipleRecordsets){
				opts["multiple"] = true;
			}

			logger.info(sql);
			driver.query(connection, sql, paramsObj, opts, function(err, recordset){
				if(err){
					logger.error(err);
					process.nextTick(function(){
						next({ message: err.code + " - EXECUTE SQL ERROR." });
					});
					return;
				}
				process.nextTick(function(){
					next(null, recordset);
				});
			});
		}
	);
}

function getConnection(next){
	var dataSource = this.dataSource,
		transaction = this.transaction,
		variableContainer = this.variableContainer,
		configuration = this.configuration.get(),
		driver = configuration["driver"];

	if(transaction){
		if(!_.findKey(variableContainer, function(value, key){ return (key === transaction.value()) ? true : false; })){
			process.nextTick(function(){
				next({ message: "Can not find the transaction by name: " + transaction.value() });
			});
			return;
		}
		process.nextTick(function(){
			next(null, variableContainer[transaction.value()]);
		});
		return;
	}

	driver.connect(dataSource.value(), function(err, connection){
		if(err){
			process.nextTick(function(){
				next(err);
			});
			return;
		}
		process.nextTick(function(){
			next(null, connection);
		});
	});
}

function setVariableContainer(variableContainer, id, value, includeAttr, scopeAttr, toArrayAttr){
	var toArray = (toArrayAttr && toArrayAttr.value() === "true") ? true : false;
	if(toArray){
		variableContainer["$context"][id] = value;
	}
	if(toArray && !_.isArray(value)){
		value = [value];
	}
	if(includeAttr && includeAttr.value() === "true"){
		if(scopeAttr){
			if(_.isUndefined(variableContainer["_includes"][scopeAttr.value()])){
				variableContainer["_includes"][scopeAttr.value()] = {};
			}
			variableContainer["_includes"][scopeAttr.value()][id] = (toArray && _.isArray(variableContainer["_includes"][scopeAttr.value()][id])) ? variableContainer["_includes"][scopeAttr.value()][id].concat(value) : value;
			return;
		}
		variableContainer["_includes"][id] = (toArray && _.isArray(variableContainer["_includes"][id])) ? variableContainer["_includes"][id].concat(value) : value;
		return;
	}
	variableContainer[id] = (toArray && _.isArray(variableContainer[id])) ? variableContainer[id].concat(value) : value;
}
