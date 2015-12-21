"use strict";

var fs = require("fs"),
	Promise = require("bluebird"),
	async = require("async"),
	_ = require("underscore"),
	path = require("path"),
	Configuration = require("./config"),
	Compiler = require("./compiler"),
	DEFAULT_CATEGORY_PARAMS = require("./default/params");

function run(){
	var actionName = arguments[0],
		category = arguments[1],
		DEFAULT_PARAMS = DEFAULT_CATEGORY_PARAMS.get(category),
		params = (arguments.length < 4) ? DEFAULT_PARAMS : _.extend(DEFAULT_PARAMS, arguments[2]),
		callback = arguments[arguments.length - 1],
		configuration = this._config,
		config = configuration.get(),
		compiler = this._compiler,
		logger = config["logger"];

	if(config["driver"] === null){
		process.nextTick(function(){
			callback({ message: "driver parameter is required." });
		});
		return;
	}

	if(typeof category === "undefined" || category === null || category === ""){
		process.nextTick(function(){
			callback({ message: "category parameter is required." });
		});
		return;
	}

	if(typeof actionName === "undefined" || actionName === null || actionName === ""){
		process.nextTick(function(){
			callback({ message: "actionName parameter is required." });
		});
		return;
	}
	var actionFile = path.join(config["actionHome"], actionName);
	
	async.waterfall(
		[
			(this.isActionFileExists).bind({ actionFile: actionFile }),
			(this.runPattern).bind({ compiler: compiler, configuration: configuration, category: category, actionFile: actionFile, params: params })
		],
		function(err, result){
			if(err){
				logger.error(err);
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			process.nextTick(function(){
				callback(null, result);
			});
		}
	);
}

function isActionFileExists(next){
	var actionFile = this.actionFile;
	fs.exists(actionFile, function(exist){
		if(!exist){
			next({ messge: "action xml file [" + actionFile + "] not exists." });
			return;
		}
		next(null);
	});
}

function runPattern(next){
	var category = this.category,
		actionFile = this.actionFile,
		params = this.params,
		configuration = this.configuration,
		compiler = this.compiler,
		variableContainer = { _params: params, _includes: {} },
		pattern;
	
	try{
		pattern = require("./category/" + category);
		pattern.run(variableContainer, actionFile, configuration, compiler, function(err, result){
			if(err){
				next(err);
				return;
			}
			next(null, result);
		});
	}catch(err){
		next(err);
		return;
	}
}

function Pattern(config){
	this._config = new Configuration(config);
	this._compiler = new Compiler({ helper: this._config["helper"] });
}

Pattern.prototype.run = run;
Pattern.prototype.runPattern = runPattern;
Pattern.prototype.isActionFileExists = isActionFileExists;
Promise.promisifyAll(Pattern.prototype);

function PatternInterface(config){
	this._pattern = new Pattern(config);
}

function runInterface(){
	var callback = arguments[arguments.length - 1];
	if(_.isFunction(callback)){
		this._pattern.run.apply(this._pattern, arguments);
	}else{
		return this._pattern.runAsync.apply(this._pattern, arguments);
	}
}

PatternInterface.prototype.run = runInterface;

module.exports = PatternInterface;