define(

	function() {
		/**
		 * Return type for SessionList.findResult().
		 * @param {Session}    session The session containing the result or null
		 * @param {BaseResult} result  The found result or null
		 */
		var SearchResult = function(session, result) {
			this.session = session;
			this.result = result;
		};

		return SearchResult;
	}
);