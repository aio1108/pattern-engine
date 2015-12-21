"use strict";

var async = require("async"),
	_ = require("underscore");

exports.run = function(gridElements, variableContainer, configuration, compiler, callback){
	async.each(
		gridElements,
		function(gridElement, next){
			processGridElement(gridElement, variableContainer, compiler, function(err){
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

function processGridElement(gridElement, variableContainer, compiler, callback){
	var columns = gridElement.find("./column"),
		ds = gridElement.attr("ds");
		
	if(ds === null){
		process.nextTick(function(){
			callback({ message: "grid type filed must have @ds attribute." });
		});
		return;
	}
	if(columns.length === 0){
		process.nextTick(function(){
			callback({ message: "grid type filed must have <column> elements." });
		});
		return;
	}

	async.waterfall(
		[
			(processGridColumns).bind({ columns: columns, gridElement: gridElement }),
			(processGridRows).bind({ columns: columns, gridElement: gridElement, ds: ds, variableContainer: variableContainer, compiler: compiler })
		],
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
}

function processGridRows(next){
	var columns = this.columns,
		ds = this.ds,
		compiler = this.compiler,
		gridElement = this.gridElement,
		rowXmlStr = "<rows>",
		variableContainer = this.variableContainer,
		rows = gridElement.node("rows", ""),
		dataset = (_.isArray(variableContainer[ds.value()])) ? variableContainer[ds.value()] : [];

	async.eachSeries(
		dataset,
		function(data, callback){
			var row = rows.node("row", "");
			rowXmlStr = rowXmlStr + "<row>";
			async.eachSeries(
				columns,
				function(column, cb){
					var html, columnName, cellValue,
						type = (!column.attr("type")) ? "" : column.attr("type").value();
					if(type === "HTML"){
						html = column.text();
						compiler.replace(html, data, function(err, str){
							if(err){
								cb(err);
								return;
							}
							row.node("cell", str);
							cb(null);
						});
					}else{
						columnName = column.attr("name");
						if(!columnName && column.attr("value")){
							cellValue = (_.isUndefined(variableContainer[column.attr("value").value()])) ? "" : variableContainer[column.attr("value").value()];
						}else{
							cellValue = (_.isUndefined(data[columnName.value()])) ? "" : data[columnName.value()];
						}
						if(cellValue === null){
							cellValue = "";
						}
						row.node("cell", cellValue.toString());
						rowXmlStr = rowXmlStr + "<cell>" + cellValue + "</cell>";
						cb(null);
						return;
					}
				},
				function(err){
					if(err){
						callback(err);
						return;
					}
					rowXmlStr = rowXmlStr + "</row>";
					callback(null);
				}
			);
		},
		function(err){
			if(err){
				next(err);
				return;
			}
			rowXmlStr = rowXmlStr + "</rows>";
			gridElement.node("rowsXml", rowXmlStr);
			next(null);
		}
	);
}

function processGridColumns(next){
	var columns = this.columns,
		gridElement = this.gridElement,
		gridHeaderContent = "",
		gridWidthContent = "",
		gridAlignContent = "",
		gridTypeContent = "";

	_.each(columns, function(column, index){
		var alignAttr = column.attr("align"),
			typeAttr = column.attr("type"),
			label = (!column.attr("label")) ? "" : column.attr("label").value(),
			width = (!column.attr("width")) ? "50" : column.attr("width").value(),
			align = (!alignAttr) ? "left" : alignAttr.value(),
			type = (!typeAttr) ? "label" : typeAttr.value();
		if(index > 0){
			gridHeaderContent = gridHeaderContent + ",";
			gridWidthContent = gridWidthContent + ",";
			gridAlignContent = gridAlignContent + ",";
			gridTypeContent = gridTypeContent + ",";
		}
		gridHeaderContent = gridHeaderContent + label;
		gridWidthContent = gridWidthContent + width;
		gridAlignContent = gridAlignContent + align;
		gridTypeContent = gridTypeContent + type;
		if(!alignAttr){
			column.attr({ "align": align });
		}
		if(!typeAttr){
			column.attr({ "type": type });
		}
	});
	gridElement.node("header", gridHeaderContent);
	gridElement.node("width", gridWidthContent);
	gridElement.node("align", gridAlignContent);
	gridElement.node("type", gridTypeContent);
	next(null);
}