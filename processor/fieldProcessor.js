"use strict";

var async = require("async"),
	_ = require("underscore");

function processFieldElement(fieldElement){
	var defaultValueElements = fieldElement.find("./defaultValue"), defaultValue;
	_.each(defaultValueElements, function(defaultValueElement){
		defaultValue = defaultValueElement.text();
		defaultValueElement.text("");
		defaultValueElement.cdata(defaultValue);
	});
}

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var fieldElements = xmlDoc.find("//field");
	async.each(
		fieldElements,
		function(fieldElement, callback){
			processFieldElement(fieldElement);
			callback(null);
		},
		function(err){
			if(err){
				process.nextTick(function(){
					next(err);
				});
				return;
			}
			next(null, xmlDoc, variableContainer, configuration, compiler);
		}
	);
};