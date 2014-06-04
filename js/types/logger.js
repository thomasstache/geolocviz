define(

	function() {

		function Logger() {

			/** @type {Array} log messages from parsing (e.g. informational messages or errors) */
			this.logMessages = [];
		}

		var LOGLEVEL = Object.freeze({ DEBUG: -1, INFO: 0, WARN: 1, ERROR: 2});

		/**
		 * Clears all stored messages.
		 */
		Logger.prototype.clearMessages = function() {
			this.logMessages = [];
		};

		/**
		 * Logs a message for the user and to the browser console.
		 * @param  {String} message The message text
		 * @param  {LOGLEVEL} level (optional) one of LOG/WARN/ERROR
		 */
		Logger.prototype.log = function(message, level) {

			level = level || LOGLEVEL.INFO;

			if (level > LOGLEVEL.DEBUG)
				this.logMessages.push(message);

			if (console) {

				if (level === LOGLEVEL.INFO) {
					console.log(message);
				}
				else if (console.debug && level === LOGLEVEL.DEBUG){
					console.debug(message);
				}
				else if (console.warn && level === LOGLEVEL.WARN){
					console.warn(message);
				}
				else if (console.error && level === LOGLEVEL.ERROR){
					console.error(message);
				}
				else {
					var prefix = level === LOGLEVEL.DEBUG ? "DEBUG: " :
								(level === LOGLEVEL.WARN ? "WARN: " :
								(level === LOGLEVEL.ERROR ? "ERROR: " : ""));
					console.log(prefix + message);
				}
			}
		};

		Logger.prototype.error = function(message) {
			this.log(message, LOGLEVEL.ERROR);
		};

		Logger.prototype.warn = function(message) {
			this.log(message, LOGLEVEL.WARN);
		};

		Logger.prototype.debug = function(message) {
			this.log(message, LOGLEVEL.DEBUG);
		};

		/**
		 * Returns the list of messages.
		 * @return {Array}
		 */
		Logger.prototype.getMessages = function() {
			return this.logMessages.slice();
		};

		// reference to the global scope ('window' in the browser). Idea from BackboneJS.
		var root = this;

		// Returns a singleton logger attached to the root scope.
		Logger.getLogger = function(){
			if (!root._logger)
				root._logger = new Logger();

			return root._logger;
		};

		return Logger;
	}
);