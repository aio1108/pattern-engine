"use strict";

exports.run = function run(next){
	var xmlDoc = this.xmlDoc,
		variableContainer = this.variableContainer,
		configuration = this.configuration,
		compiler = this.compiler;
	next(null, xmlDoc, variableContainer, configuration, compiler);
};
