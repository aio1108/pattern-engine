"use strict";

function log(msg){
	console.log(msg);
}

function info(msg){
	log(msg);
}

function debug(msg){
	log(msg);
}

function warn(msg){
	log(msg);
}

function error(msg){
	log(msg);
}

exports.info = info;
exports.debug = debug;
exports.warn = warn;
exports.error = error;