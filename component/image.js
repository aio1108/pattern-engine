"use strict";

var async = require("async");

function processImageElement(imageElement){
	var defaultValueElement = (!imageElement.get("./defaultValue")) ? imageElement.node("defaultValue", "") : imageElement.get("./defaultValue"),
		defaultValue = defaultValueElement.text();
	if(defaultValue !== ""){
		defaultValue = defaultValue.replace("dataimage/jpegbase64", "data:image/jpeg;base64,");
		defaultValue = (defaultValue.indexOf("data:") === -1) ? "data:image/jpeg;base64," + defaultValue : defaultValue;
		defaultValueElement.text("");
		defaultValueElement.cdata(defaultValue);
	}
}

exports.run = function(imageElements, variableContainer, configuration, compiler, callback){
	async.each(
		imageElements,
		function(imageElement, next){
			processImageElement(imageElement);
			next(null);
		},
		function(err){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			callback(null);
		}
	);
};