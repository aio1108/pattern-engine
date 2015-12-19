"use strict";

var async = require("async"),
	_ = require("underscore");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var templateElement, paramElements, datasetElement, datasetNameAttr, typeAttr, outputAttr,
		data = null,
		paramsObj = {},
		opts = { type: "stream", output: "pdf" },
		reporter = configuration.get()["report"],
		reportElement = xmlDoc.get("./report");

	if(reporter === null){
		next({ message: "report configuration must be set when run the report category." });
		return;
	}

	if(!reportElement){
		next({ message: "<report> element must be set when run the report category." });
		return;
	}

	typeAttr = reportElement.attr("type");
	if(typeAttr){
		if(typeAttr.value() !== "buffer" && typeAttr.value() !== "stream"){
			next({ message: "@type attribute only accept \"buffer\" or \"stream\"." });
			return;
		}
		opts["type"] = typeAttr.value();
	}

	outputAttr = reportElement.attr("output");
	if(outputAttr){
		if(outputAttr.value() !== "pdf" && outputAttr.value() !== "html"){
			next({ message: "@output attribute only accept \"pdf\" or \"html\"." });
			return;
		}
		opts["output"] = outputAttr.value();
	}

	templateElement = reportElement.get("./template");
	if(!templateElement){
		next({ message: "<report> element must have <template> child element." });
		return;
	}

	datasetElement = reportElement.get("./dataset");
	if(datasetElement){
		datasetNameAttr = datasetElement.attr("name");
		if(!datasetNameAttr){
			next({ message: "<dataset> element must have @name attribute." });
			return;
		}
		if(_.isUndefined(variableContainer[datasetNameAttr.value()])){
			next({ message: "can not find dataset with name: " + datasetNameAttr.value() });
			return;
		}
		data = variableContainer[datasetNameAttr.value()];
	}

	paramElements = reportElement.find("./param");
	async.each(
		paramElements,
		function(param, cb){
			var paramValue,
				paramNameAttr = param.attr("name"),
				paramValueAttr = param.attr("value"),
				paramTypeAttr = param.attr("type");
			if(!paramNameAttr || !paramValueAttr){
				cb({ message: "<param> element must have @name and @value attribute." });
				return;
			}
			paramValue = paramValueAttr.value();
			if(paramTypeAttr && paramTypeAttr.value() === "dataset"){
				paramsObj[paramNameAttr.value()] = variableContainer[paramValue];
				cb(null);
				return;
			}
			compiler.compile(paramValue, variableContainer, function(err, res){
				if(err){
					cb(err);
					return;
				}
				if(paramTypeAttr && paramTypeAttr.value() === "integer"){
					try{
						res = { "value": parseInt(res, 10), type: "integer" };
						res = JSON.stringify(res);
					}catch(e){
						cb({ message: "can not convert param value to integer." });
						return;
					}
				}
				paramsObj[paramNameAttr.value()] = res;
				cb(null);
			});
		},
		function(err){
			if(err){
				next(err);
				return;
			}
			reporter.generate(templateElement.text(), data, paramsObj, opts, function(err, result){
				if(err){
					next(err);
					return;
				}
				next(null, result, variableContainer, configuration, compiler);
			});
		}
	);
};
