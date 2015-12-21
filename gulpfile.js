"use strict";

var gulp = require("gulp"),
	fs = require("fs"),
	eslint = require("gulp-eslint");

var lintFileStream = fs.createWriteStream("lint.html");

gulp.task("lint", function(){
	return gulp.src(["**/*.js", "!node_modules/**"])
		.pipe(eslint())
		.pipe(eslint.format("html", lintFileStream));
});

gulp.task("default", ["lint"], function(){
	console.log("Lint finished.");
});