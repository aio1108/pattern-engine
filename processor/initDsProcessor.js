"use strict";

var libxmljs = require("libxmljs"),
	_ = require("underscore"),
	dsProcessor = require("./dsProcessor");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var root,
		dataSetList,
		tempDoc = new libxmljs.Document("1.0", "utf-8"),
		initDsElements = xmlDoc.find("./initDataSetList/*");
	root = tempDoc.node("action", "");
	dataSetList = root.node("dataSetList", "");
	_.each(initDsElements, function(initDsElement){
		dataSetList.addChild(initDsElement);
	});
	dsProcessor.run(tempDoc, variableContainer, configuration, compiler, function(err, doc, iVariableContainer, iConfiguration, iCompiler){
		if(err){
			next(err);
			return;
		}
		next(null, xmlDoc, iVariableContainer, iConfiguration, iCompiler);
	});
};