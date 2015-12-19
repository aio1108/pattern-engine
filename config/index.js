"use strict";

var _ = require("underscore"),
	DEFAULT_LOGGER = require("../default/logger");

function Configuration(config){
	this._config = {
		actionHome: "",
		serviceHome: "",
		templateHome: "",
		driver: null,
		render: null,
		logger: DEFAULT_LOGGER,
		helper: null
	};
	_.extend(this._config, config);
}

Configuration.prototype.get = function(){
	return _.extend({}, this._config);
};

module.exports = Configuration;
