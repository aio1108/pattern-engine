"use strict";

var async = require("async"),
	path = require("path"),
	_ = require("underscore");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var dsElements = xmlDoc.find("./dataSetList/*");
	processDatasetElements(dsElements, variableContainer, configuration, compiler, function(err){
		if(err){
			next(err);
			return;	
		}
		next(null, xmlDoc, variableContainer, configuration, compiler);
	});
};

function processDatasetElements(dsElements, variableContainer, configuration, compiler, callback){
	async.eachSeries(
		dsElements, 
		function(dsElement, next){ 
			if(dsElement.name() === "dataset"){
				processDataset(dsElement, variableContainer, configuration, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}else if(dsElement.name() === "variable"){
				processVariable(dsElement, variableContainer, compiler, function(err){
					if(err){
						next(err);
						return;
					}
					next(null);
				});
			}else{
				next(null);
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

function processDataset(ds, variableContainer, configuration, compiler, callback){
	var params = ds.find("./param");

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
		function(err){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			getData(ds, variableContainer, configuration, compiler, function(err){
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

function processVariable(variable, variableContainer, compiler, callback){
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

function getData(ds, variableContainer, configuration, compiler, callback){
	var id = ds.attr("id"),
		type = ds.attr("type");
	if(type.value() === "sql"){
		getDataBySQL(ds, variableContainer, configuration, compiler, function(err, data){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			setVariableContainer(variableContainer, id.value(), data, ds.attr("_includes"), ds.attr("_scope"));
			callback(null);
		});
	}else if(type.value() === "service"){
		getDataByService(ds, variableContainer, configuration, compiler, function(err, data){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			setVariableContainer(variableContainer, id.value(), data, ds.attr("_includes"), ds.attr("_scope"));
			callback(null);
		});
	}else{
		process.nextTick(function(){
			callback({ message: "Unknow type of dataset." });
		});
	}
}

function getDataByService(ds, variableContainer, configuration, compiler, callback){
	var params, serviceName, serviceOperation, serviceObj,
		config = configuration.get(),
		paramsObj = {},
		serviceHome = config["serviceHome"],
		serviceElement = ds.get("./service");
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
		params = ds.find("./param");

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

function getDataBySQL(ds, variableContainer, configuration, compiler, callback){
	var multiple,
		sqlElement = ds.get("./sql"),
		dataSource = ds.attr("data_source"),
		multipleRecordsets = false;

	if(!sqlElement || !dataSource){
		process.nextTick(function(){
			callback({ message: "sql type dataset must have <sql> child element and @data_source attribute" });
		});
		return;
	}

	multiple = sqlElement.attr("multiple");
	if(multiple && multiple.value() === "true"){
		multipleRecordsets = true
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
					(getConnection).bind({ dataSource: dataSource, configuration: configuration }),
					(executeSQL).bind({ ds: ds, sql: sql, multipleRecordsets: multipleRecordsets, configuration: configuration })
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
		ds = this.ds,
		params = ds.find("./param"),
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
						next({ message: err.code+" - EXECUTE SQL ERROR." });
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
		configuration = this.configuration.get(),
		driver = configuration["driver"];
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

function setVariableContainer(variableContainer, id, value, includeAttr, scopeAttr){
	if(includeAttr && includeAttr.value() === "true"){
		if(scopeAttr){
			variableContainer["_includes"][scopeAttr.value()][id] = value;
			return;
		}
		variableContainer["_includes"][id] = value;
		return;
	}
	variableContainer[id] = value;
}