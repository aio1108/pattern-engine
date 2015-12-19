"use strict";

function get(category){
	var DEFAULT_CATEGORY_PARAMS = {
		"form": {
			"showJSON": false,
			"session": {}
		},
		"formPost": {
			"_event": null
		},
		"report": {
			"_event": null
		},
		"dao": {
			"_event": null
		}
	};

	return (DEFAULT_CATEGORY_PARAMS[category]) ? DEFAULT_CATEGORY_PARAMS[category] : {};
}

exports.get = get;