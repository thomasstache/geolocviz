define(
	["jquery", "underscore", "backbone",
	 "types/searchquery"],

	function($, _, Backbone, SearchQuery) {

		var SearchView = Backbone.View.extend({
			el: $("#searchView"),

			$helpPanel: null,
			$searchInput: null,

			events: {
				"change #searchInput" : "searchInputChanged",
				"focus #searchInput"  : "searchFocussed",
				"blur #searchInput"   : "searchBlurred",
			},

			initialize: function() {
				this.render();
			},

			render: function() {

				this.$searchInput = this.$("#searchInput");
				this.$helpPanel = this.$("#searchHelp");

				return this;
			},

			// Handler for "change" event from the search field.
			searchInputChanged: function(evt) {

				var searchText = evt.target.value;
				if (searchText === undefined || searchText === "")
					return;

				var prefix = searchText[0],
					suffix = searchText.slice(1);

				var topic, what;
				switch (prefix) {
					case "@":
						topic = SearchQuery.TOPIC_NETWORK; what = suffix;
						break;
					case ":":
						topic = SearchQuery.TOPIC_SESSION; what = suffix;
						break;
					case "#":
						topic = SearchQuery.TOPIC_RESULT; what = suffix;
						break;
					default:
						topic = SearchQuery.TOPIC_RESULT; what = searchText;
				}

				this.trigger("search", new SearchQuery(topic, what));
				this.$searchInput.focusout();
			},

			clearSearchField: function() {
				$("#searchInput").val("");
			},

			searchFocussed: function() {
				this.$helpPanel.fadeIn("fast");
			},

			searchBlurred: function() {
				this.$helpPanel.fadeOut("fast");
			}
		});

		return SearchView;
	}
);