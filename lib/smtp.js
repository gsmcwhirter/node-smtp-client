/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil -*- */
/*===============================================
	File: smtp.js
	Author: Micheil Smith
	
	Description:
		Implements two wrappers around the
		submodules, currently provides an SMTP
		Client.
===============================================*/

/*-----------------------------------------------
	SMTP Client
-----------------------------------------------*/
var Client = function(){
	var SMTPClient = require("./smtp/client").Client;
	return new SMTPClient(arguments);
};


/*-----------------------------------------------
	Exports
-----------------------------------------------*/
exports.Client = Client;

