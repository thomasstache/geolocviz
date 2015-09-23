define(

	function() {
		var SearchQuery = function(topic, searchterm) {
			this.topic = topic;
			this.searchterm = searchterm;
		};

		Object.defineProperty(SearchQuery, "TOPIC_NETWORK", { value: "network" });
		Object.defineProperty(SearchQuery, "TOPIC_CHANNELNUMBER", { value: "channel" });
		Object.defineProperty(SearchQuery, "TOPIC_SESSION", { value: "session" });
		Object.defineProperty(SearchQuery, "TOPIC_RESULT", { value: "result" });

		return SearchQuery;
	}
);