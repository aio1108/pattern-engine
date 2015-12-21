"use strict";

var async = require("async"),
	path = require("path"),
	libxmljs = require("libxmljs"),
	_ = require("underscore"),
	fs = require("fs");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	async.series(
		[
			(getIncludeDsElements).bind({ xmlDoc: xmlDoc, configuration: configuration }),
			(getIncludeProcessElements).bind({ xmlDoc: xmlDoc, configuration: configuration })
		],
		function(err){
			if(err){
				next(err);
				return;
			}
			next(null, xmlDoc, variableContainer, configuration, compiler);
		}
	);
};

function getIncludeDsElements(next){
	var xmlDoc = this.xmlDoc,
		configuration = this.configuration,
		includeElements = xmlDoc.find("./dataSetList//include");
	async.eachSeries(
		includeElements,
		function(includeElement, callback){
			async.waterfall(
				[
					(readIncludeFile).bind({ includeElement: includeElement, configuration: configuration }),
					(getImportElements).bind({ includeElement: includeElement, xpath: "./dataSetList/*" }),
					(setAttributes).bind({ includeElement: includeElement }),
					(insertImportElements).bind({ includeElement: includeElement })
				],
				function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				}
			);
		},
		function(err){
			if(err){
				next(err);
				return;
			}
			next(null);
		}
	);
}

function getIncludeProcessElements(next){
	var xmlDoc = this.xmlDoc,
		configuration = this.configuration,
		includeElements = xmlDoc.find("./processList//include");
	async.eachSeries(
		includeElements,
		function(includeElement, callback){
			async.waterfall(
				[
					(readIncludeFile).bind({ includeElement: includeElement, configuration: configuration }),
					(getImportElements).bind({ includeElement: includeElement, xpath: "./processList/*" }),
					function(importElements, cb){
						_.each(importElements, function(importElement){
							var childProcessElements;
							if(importElement.name() !== "process"){
								childProcessElements = importElement.find(".//process");
								(setAttributes).bind({ includeElement: includeElement })(childProcessElements, function(){});
							}else{
								(setAttributes).bind({ includeElement: includeElement })([importElement], function(){});
							}
						});
						cb(null, importElements);
					},
					(insertImportElements).bind({ includeElement: includeElement })
				],
				function(err){
					if(err){
						callback(err);
						return;
					}
					callback(null);
				}
			);
		},
		function(err){
			if(err){
				next(err);
				return;
			}
			next(null);
		}
	);
}

function readIncludeFile(next){
	var filePath,
		includeElement = this.includeElement,
		configuration = this.configuration,
		fileAttr = includeElement.attr("file"),
		actionHome = configuration.get().actionHome;
	if(!fileAttr){
		next({ message: "<include> element must have @file attribute." });
		return;
	}
	filePath = path.join(actionHome, "action", fileAttr.value().replace("/", path.sep));
	fs.readFile(filePath, { encoding: "utf-8" }, function(err, data){
		if(err){
			next({ message: "Can not read the file: " + filePath + "." });
			return;
		}
		next(null, data);
	});
}

function getImportElements(data, next){
	var importXmlDoc, importElements,
		includeElement = this.includeElement,
		xpath = this.xpath,
		targetAttr = includeElement.attr("target"),
		target = (targetAttr) ? "[@id=\"" + targetAttr.value() + "\"]" : "";
	importXmlDoc = libxmljs.parseXmlString(data);
	importElements = importXmlDoc.find(xpath + target);
	next(null, importElements);
}

function setAttributes(importElements, next){
	var includeElement = this.includeElement,
		scopeAttr = includeElement.attr("scope");
	_.each(importElements, function(importElement){
		var attrObj = { _include: true };
		if(scopeAttr){
			attrObj["_scope"] = scopeAttr.value();
		}
		importElement.attr(attrObj);
	});
	next(null, importElements);
}

function insertImportElements(importElements, next){
	var includeElement = this.includeElement;
	_.each(importElements, function(importElement){
		includeElement.addPrevSibling(importElement);
	});
	next(null);
}