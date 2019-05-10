const moment = require('moment');

var log = function(message, color)
{
	var colors = {
		"error" 		: "\033[91m",
		"success" 		: "\033[92m",
		"info" 			: "\033[96m",
		"debug" 		: "\033[95m",
		"yellow" 		: "\033[93m",
		"log"           : "\033[36m",
		"lightgray" 	: "\033[97m",
		"reset"			: "\033[00m"
	}

	var msg = "";

	if(color) {
		msg += colors[color] + message + colors["reset"]
	} else {
		msg = message
	}


	console.log(`[${moment().format('hh:mm:ss:SS')}] ${msg}`)
}

module.exports = log;