## Gama Pattern Module

---

It is a pattern engine module for building Web application more faster and easier.

### Install and Configure

You can install it as below:

	var pattern = require('gama-pattern')(config);

The configuration object contains follow properties:

* ***actionHome:*** The absolute path of the folder that sotres ***action*** XML files
* ***serviceHome:*** The absolute path of the folder that sotres ***service*** js files
* ***databases:*** The configuration object for database connection information.

A configuration object sample likes this:

	{
  		"actionHome": "/path/to/action/files/folder",
  		"serviceHome": "/path/to/service/files/folder",
  		"databases": {
    		"databaseKey1": {
      			"user": "userName",
      			"password": "userPassword",
      			"server": "192.0.0.1",
      			"database": "databaseName",
      			"pool": {
        			"max": 3,
        			"min": 0,
        			"idleTimeoutMillis": 30000
      			},
      			"options": {
        			"encrypt": false,
        			"useUTC": false
      			}
    		}
  		}
	}


### Usage

	pattern.run(actionFile, category, callback);

The first parameter(***actionFile***) is the name of the action XML file. 

The second parameter(***category***) is the name of the category. There are three categories(***form***, ***dao*** and ***report***) in the pattern engine now. The same action XML file could produce different result depends on the category parameter.

The last parameter(***callback***) is a callback function. This callback function will take two arguments(***error***, ***result***). The first argument is an error object. It will be null if the pattern engine executed action XML file without error. The second argument is the result that be produced by the pattern engine. The result could be HTML string or JSON object or something else, it depends on the category you choosed.

 