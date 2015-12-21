"use strict";

var path = require("path"),
	fs = require("fs"),
	async = require("async"),
	xml2js = require("xml2js").parseString,
	_ = require("underscore");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var templateFileName, templateFilePath,
		templateElement = xmlDoc.get("./template"),
		config = configuration.get(),
		renderEngine = config["render"],
		logger = config["logger"],
		showJSON = variableContainer["_params"]["showJSON"];

	if(renderEngine === null){
		next({ message: "Setting render is required before run the render process." });
		return;
	}

	if(showJSON !== undefined && showJSON === "true"){
		async.waterfall(
			[
				(transformXmlToJs).bind({ xmlDoc: xmlDoc })
			],
			function(err, result){
				if(err){
					next(err);
					return;
				}
				result.data = variableContainer.data;
				next(null, result, variableContainer, configuration, compiler);
			}
		);
	}else{
		if(!templateElement){
			next({ message: "<template> element does not exist." });
			return;
		}
		templateFileName = templateElement.text();
		if(templateFileName === ""){
			next({ message: "template file name does not set" });
			return;
		}

		templateFilePath = path.join(config["templateHome"], templateFileName);

		async.waterfall(
			[
				(isTemplateFileExists).bind({ templateFilePath: templateFilePath }),
				(transformXmlToJs).bind({ xmlDoc: xmlDoc, variableContainer: variableContainer }),
				(runTemplateTransform).bind({ templateFilePath: templateFilePath, renderEngine: renderEngine, logger: logger })
			],
			function(err, result){
				if(err){
					next(err);
					return;
				}
				next(null, result, variableContainer, configuration, compiler);
			}
		);
	}
};

function isTemplateFileExists(next){
	var templateFilePath = this.templateFilePath;
	fs.exists(templateFilePath, function(exist){
		if(!exist){
			next({ messge: "template file [" + templateFilePath + "] not exists." });
			return;
		}
		next(null);
	});
}

function transformXmlToJs(next){
	var xmlDoc = this.xmlDoc,
		variableContainer = this.variableContainer,
		xmlStr = xmlDoc.toString();
	try{
		xml2js(xmlStr, { explicitCharkey: true }, function(err, result){
			if(err){
				next(err);
				return;
			}
			result.req = { "session": {} };
			if(variableContainer["_params"]["session"]){
				_.extend(result.req.session, variableContainer["_params"]["session"]);
			}
			next(null, result);
		});
	}catch(err){
		next(err);
		return;
	}
}

function runTemplateTransform(jsObj, next){
	var templateFilePath = this.templateFilePath,
		renderEngine = this.renderEngine,
		logger = this.logger;
	async.waterfall(
		[
			(applyTemplateFile).bind({ templateFilePath: templateFilePath, jsObj: jsObj, renderEngine: renderEngine, logger: logger })
		],
		function(err, result){
			if(err){
				next(err);
				return;
			}
			next(null, result);
		}
	);
}

function applyTemplateFile(next){
	var jsObj = this.jsObj,
		logger = this.logger,
		renderEngine = this.renderEngine,
		templateFilePath = this.templateFilePath;

	renderEngine.render(templateFilePath, jsObj, function(err, result){
		if(err){
			logger.error(err);
			next(err);
			return;
		}
		next(null, result);
	});
}