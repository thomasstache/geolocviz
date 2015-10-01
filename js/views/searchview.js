define(
	["jquery", "underscore", "backbone",
	 "types/searchquery"],

	function($, _, Backbone, SearchQuery) {

		/**
		 * Info View.
		 * Emits the following events:
		 *   search (SearchQuery)
		 */
		var SearchView = Backbone.View.extend({

			constructor: function SearchView() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			el: $("#searchView"),

			$helpPanel: null,
			$searchInput: null,

			events: {
				"change #searchInput" : "searchInputChanged",
				"keyup #searchInput"   : "searchInputKeyUp",
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

				if (evt.target.value === undefined || evt.target.value.trim() === "")
					return;

				var searchText = evt.target.value.trim();

				var prefix = searchText[0],
					suffix = searchText.slice(1);

				var topic, what;
				switch (prefix) {
					case "@":
						topic = SearchQuery.TOPIC_NETWORK; what = suffix;

						// channel searches start with additional prefix
						if (suffix.indexOf(PREFIX_CHANNELSEARCH) === 0) {
							topic = SearchQuery.TOPIC_CHANNELNUMBER;
							what = suffix.slice(PREFIX_CHANNELSEARCH.length);
						}
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

				if (what.length === 0)
					return;

				this.trigger("search", new SearchQuery(topic, what));
				this.$searchInput.focusout();
			},

			searchInputKeyUp: function(evt) {
				if (evt.keyCode != 13)
					return;

				// ENTER pressed, trigger search
				this.searchInputChanged(evt);
			},

			clearSearchField: function() {
				this.$searchInput.val("");
			},

			searchFocussed: function() {
				this.$helpPanel.fadeIn("fast");
			},

			searchBlurred: function() {
				this.$helpPanel.fadeOut("fast");
			}
		});

		var PREFIX_CHANNELSEARCH = "ch:";

		return SearchView;
	}
);