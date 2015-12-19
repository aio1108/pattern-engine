"use strict";

var async = require("async"),
	_ = require("underscore");

function processDefaultValue(selectableElement){
	var defaultValueArr,
		defaultValueElement = (selectableElement.get("./defaultValue") === null) ? selectableElement.node("defaultValue", "") : selectableElement.get("./defaultValue"),
		defaultValue = defaultValueElement ? defaultValueElement.text() : "",
		type = selectableElement.attr("type");

	if(type === "CHECKBOX" || type === "MULTISELECT"){
		defaultValueArr = defaultValue.split(",");
		defaultValueElement.remove();
		_.each(defaultValueArr, function(value){
			var element = selectableElement.node("defaultValue", "");
			element.cdata(value);
		});
	}
}

function processItems(selectableElement, variableContainer){
	var items, dataset,
		displayAttr = selectableElement.attr("display"),
		valueAttr = selectableElement.attr("value"),
		ds = selectableElement.attr("ds");
	if(!ds){
		return;
	}
	items = selectableElement.node("items", "");
	dataset = (_.isArray(variableContainer[ds.value()])) ? variableContainer[ds.value()] : [];
	_.each(dataset, function(data){
		var item = items.node("item", ""),
			display = (!displayAttr) ? "" : data[displayAttr.value()],
			value = (!valueAttr) ? "" : data[valueAttr.value()];
		item.attr({ display: display, value: value });
	});
}

function processSelectableElement(selectableElement, variableContainer, callback){
	processDefaultValue(selectableElement);
	processItems(selectableElement, variableContainer);
	process.nextTick(function(){
		callback(null);
	});
}

exports.run = function(selectableElements, variableContainer, configuration, compiler, callback){
	async.each(
		selectableElements,
		function(selectableElement, next){
			processSelectableElement(selectableElement, variableContainer, function(err){
				if(err){
					next(err);
					return;
				}
				next(null);
			});
		},
		function(err){
			if(err){
				process.nextTick(function(){
					callback(err);
				});
				return;
			}
			process.nextTick(function(){
				callback(null);
			});
		}
	);
};