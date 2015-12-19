"use strict";

var fs = require("fs"),
	async = require("async"),
	libxmljs = require("libxmljs"),
	startupProcessor = require("../processor/startupProcessor"),
	includeProcessor = require("../processor/includeProcessor"),
	dsProcessor = require("../processor/dsProcessor"),
	expressionProcessor = require("../processor/expressionProcessor"),
	componentProcessor = require("../processor/componentProcessor"),
	fieldProcessor = require("../processor/fieldProcessor"),
	renderProcessor = require("../processor/renderProcessor");

function runAction(actionFile, variableContainer, configuration, compiler, callback){
	fs.readFile(actionFile, { encoding: "utf-8" }, function(err, data){
		var xmlDoc;
		if(err){
			process.nextTick(function(){
				callback(err);
			});
			return;
		}

		try{

			xmlDoc = libxmljs.parseXmlString(data);
			async.waterfall(
				[
					(startupProcessor.run).bind({ variableContainer: variableContainer, xmlDoc: xmlDoc, configuration: configuration, compiler: compiler }),
					includeProcessor.run,
					dsProcessor.run,
					expressionProcessor.run,
					fieldProcessor.run,
					componentProcessor.run,
					renderProcessor.run
				],
				function(err, htmlResult){
					if(err){
						process.nextTick(function(){
							callback(err);
						});
						return;
					}
					process.nextTick(function(){
						callback(null, htmlResult);
					});
				}
			);

		}catch(e){
			process.nextTick(function(){
				callback(e);
			});
			return;
		}
	});
}

exports.run = function(variableContainer, actionFile, configuration, compiler, callback){
	runAction(actionFile, variableContainer, configuration, compiler, function(err, result){
		if(err){
			process.nextTick(function(){
				callback(err);
			});
			return;
		}
		process.nextTick(function(){
			callback(null, result);
		});
	});
};