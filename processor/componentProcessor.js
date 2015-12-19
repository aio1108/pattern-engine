"use strict";

var async = require("async"),
	_ = require("underscore"),
	config = require("../config/config.component.json");

exports.run = function(xmlDoc, variableContainer, configuration, compiler, next){
	var components = config["components"],
		keys = _.keys(components),
		logger = configuration.get()["logger"];
	async.each(
		keys,
		function(key, callback){
			var fields = xmlDoc.find("//field[@type=\"" + key + "\"]"),
				componentName = components[key]["name"],
				component;
			try{
				component = require("../component/" + componentName);
			}catch(err){
				logger.error(err);
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			component.run(fields, variableContainer, configuration, compiler, function(err){
				if(err){
					logger.error(err);
				}
				callback(null);
			});
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