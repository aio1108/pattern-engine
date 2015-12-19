"use strict";

var jexl = require("jexl"),
	reloader = require("freshy"),
	_ = require("underscore"),
	async = require("async");

function Compiler(conf){
	var freshJexl = reloader.freshy("jexl"),
		DEFAULT_CONFIG = {
			helper: null
		},
		config = (arguments < 1)?DEFAULT_CONFIG:_.extend(DEFAULT_CONFIG, conf);

	if(config["helper"] !== null && _.isObject(config["helper"])){
		_.each(config["helper"], function(fn, key){
			freshJexl.addTransform(key, fn);
		});
	}

	freshJexl.addBinaryOp("gt", 20, function(left, right){
		return (left > right)?true:false;
	});

	freshJexl.addBinaryOp("lt", 20, function(left, right){
		return (left < right)?true:false;
	});

	freshJexl.addBinaryOp("gte", 20, function(left, right){
		return (left >= right)?true:false;
	});

	freshJexl.addBinaryOp("lte", 20, function(left, right){
		return (left <= right)?true:false;
	});

	freshJexl.addBinaryOp("and", 10, function(left, right){
		return left && right;
	});

	this._compiler = freshJexl;
}

function compile(str, ctx, cb){
	var match, matchStr,
		compiler = this._compiler,
		PATTERN = /\$\{([\s\S]+?)\}/g;
	if((match = PATTERN.exec(str)) !== null){
		matchStr = match[0].substring(2, match[0].length - 1);
		compiler.eval(matchStr, ctx)
			.then(function(res){
				process.nextTick(function(){
					cb(null, res);
				});
			})
			.catch(function(err){
				process.nextTick(function(){
					cb(err);
				});
			});
	}else{
		process.nextTick(function(){
			cb(null, str);
		});
	}
}

function replace(str, ctx, cb){
	var arr = match(str),
		result = str;
	async.each(
		arr,
		function(item, next){
			compile(item, ctx, function(err, res){
				if(err){
					next(err);
					return;
				}
				result = result.replace(item, res);
				next(null);
			});
		},
		function(err){
			if(err){
				process.nextTick(function(){
					cb(err);
				});
				return;
			}
			process.nextTick(function(){
				cb(null, result);
			});
		}
	);
}

function match(str){
	var match,
		PATTERN = /\$\{([\s\S]+?)\}/g,
		result = [];
	while ((match = PATTERN.exec(str)) !== null) {
		if (match.index === PATTERN.lastIndex) {
			PATTERN.lastIndex++;
		}
		result.push(match[0]);
	}
	return result;
}

Compiler.prototype.compile = compile;
Compiler.prototype.replace = replace;

module.exports = Compiler;