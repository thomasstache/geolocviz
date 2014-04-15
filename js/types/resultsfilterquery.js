define(

	function() {
		/**
		 * Parameters for filtering results on the map.
		 * @param {enum} topic       one of the topics defined below
		 * @param {String} title     to be displayed in filter info bar
		 * @param {int} netSegment   the results network segment (RNC, TAC, ...)
		 * @param {int} cellIdentity sector Id
		 */
		var ResultsFilterQuery = function(topic, title, netSegment, cellIdentity) {
			this.topic = topic;

			this.title = title;
			this.netSegment = netSegment;
			this.cellIdentity = cellIdentity;
		};

		Object.defineProperty(ResultsFilterQuery, "TOPIC_PRIMARYCELL", { value: "primarycell" });
		Object.defineProperty(ResultsFilterQuery, "TOPIC_REFERENCECELL", { value: "referencecell" });

		return ResultsFilterQuery;
	}
);