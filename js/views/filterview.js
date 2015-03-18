define(
	["jquery", "backbone",
	 "hbs!templates/filterbar"],

	function($, Backbone, filterbarTemplate) {

		var FilterView = Backbone.View.extend({

			constructor: function FilterView() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			el: $("#filterBar"),

			/** @type {AppState} the shared app state */
			model: null,

			events: {
				"click #clearFilters": "clearFilterClicked",
			},

			initialize: function() {

				// "model" is the AppState
				this.model.on("change:resultsFilterActive", this.onFilterChanged, this);
				this.model.on("change:resultsFilterQuery", this.onQueryChanged, this);
				this.render();
			},

			render: function() {

				var context = this.model.get("resultsFilterQuery");
				this.$("#clearFilters").html(filterbarTemplate(context !== null ? context : {}));
				return this;
			},

			onFilterChanged: function(event) {

				if (event.changed.resultsFilterActive)
					this.$el.show();
				else
					this.$el.hide();
			},

			onQueryChanged: function() {

				this.render();
			},

			clearFilterClicked: function() {

				this.trigger("results:clear-filter");
			},
		});

		return FilterView;
	}
);
