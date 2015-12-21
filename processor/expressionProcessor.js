"use strict";

var libxmljs = require("libxmljs");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	compiler.replace(xmlDoc.toString(), variableContainer, function(err, str){
		var compiledXmlDoc;
		if(err){
			next(err);
			return;
		}
		try{
			compiledXmlDoc = libxmljs.parseXmlString(str);
			next(null, compiledXmlDoc, variableContainer, configuration, compiler);
			return;
		}catch(e){
			next(e);
			return;
		}
	});
};