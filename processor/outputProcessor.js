"use strict";

var async = require("async");

function handleConditionElement(item, variableContainer, resultObj, compiler, callback){
	var paramValue, elements,
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
			elements = item.find("./*");
			handleElements(elements, variableContainer, resultObj, compiler, function(err){
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
		}else{
			process.nextTick(function(){
				callback(null);
			});
		}
	});
}

function handlePropertyElement(property, variableContainer, resultObj, compiler, callback){
	var propertyNameAttr = property.attr("name"),
		propertyDatasetAttr = property.attr("dataset"),
		propertyValueAttr = property.attr("value");
	if(!propertyNameAttr){
		process.nextTick(function(){
			callback({ message: "<property> element must have @name attribute." });
		});
		return;
	}
	if(!propertyValueAttr && !propertyDatasetAttr){
		process.nextTick(function(){
			callback({ message: "<property> element must have @dataset or @value attribute." });
		});
		return;
	}

	if(propertyDatasetAttr){
		try{
			resultObj[propertyNameAttr.value()] = variableContainer[propertyDatasetAttr.value()];
			process.nextTick(function(){
				callback(null);
			});
			return;
		}catch(err){
			process.nextTick(function(){
				callback(err);
			});
			return;
		}
	}

	if(propertyValueAttr){
		compiler.compile(propertyValueAttr.value(), variableContainer, function(err, res){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			resultObj[propertyNameAttr.value()] = res;
			process.nextTick(function(){
				callback(null);
			});
		});
	}
}

function handleElements(elements, variableContainer, resultObj, compiler, callback){
	async.each(
		elements,
		function(element, cb){
			var elementName = element.name();
			if(elementName === "property"){
				handlePropertyElement(element, variableContainer, resultObj, compiler, function(err){
					if(err){
						cb(err);
						return;
					}
					cb(null);
				});
			}else if(elementName === "if"){
				handleConditionElement(element, variableContainer, resultObj, compiler, function(err){
					if(err){
						cb(err);
						return;
					}
					cb(null);
				});
			}else{
				cb(null);
				return;
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

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var elements,
		resultObj = {},
		output = xmlDoc.get("./output"),
		processList = xmlDoc.get("./processList"),
		logger = configuration.get()["logger"];

	if(processList){
		var process = processList.find("./process");
		async.each(
			process,
			function(property, callback){
				var propertyIDAttr = property.attr("id"),
					propertyOUTPUTAttr = property.attr("output");

				try{
					if(propertyOUTPUTAttr !== null && propertyOUTPUTAttr.value() === "true"){
						resultObj[propertyIDAttr.value()] = variableContainer[propertyIDAttr.value()];
					}
					callback(null);
					return;
				}catch(err){
					logger.error(err);
					callback(err);
					return;
				}
			},
			function(err){
				if(err){
					next(err);
					return;
				}
			}
		);
	}

	if(!output){
		next(null, resultObj, variableContainer, configuration, compiler);
		return;
	}

	elements = output.find("./*");
	handleElements(elements, variableContainer, resultObj, compiler, function(err){
		if(err){
			next(err);
			return;
		}
		next(null, resultObj, variableContainer, configuration, compiler);
	});
};