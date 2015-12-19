"use strict";

var fs = require("fs"),
	async = require("async"),
	libxmljs = require("libxmljs"),
	startupProcessor = require("../processor/startupProcessor"),
	includeProcessor = require("../processor/includeProcessor"),
	processProcessor = require("../processor/processProcessor"),
	outputProcessor = require("../processor/outputProcessor");

function runActionPostBack(actionFile, variableContainer, configuration, compiler, callback){
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
					processProcessor.run,
					outputProcessor.run
				],
				function(err, jsonResult){
					if(err){
						process.nextTick(function(){
							callback(err);
						});
						return;
					}
					process.nextTick(function(){
						callback(null, jsonResult);
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
	runActionPostBack(actionFile, variableContainer, configuration, compiler, function(err, result){
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