define(
	["jquery", "backbone"],

	function($, Backbone) {

		var FilterView = Backbone.View.extend({
			el: $("#filters"),

			events: {
				"click #clearFilters": "clearFilterClicked",
			},

			initialize: function() {

				// "model" is the AppState
				this.model.on("change:resultsFilterActive", this.onFilterChanged, this);
				this.render();
			},

			onFilterChanged: function(event) {

				if (event.changed.resultsFilterActive)
					this.$el.show();
				else
					this.$el.hide();
			},

			clearFilterClicked: function() {

				this.trigger("results:clear-filter");
			},
		});

		return FilterView;
	}
);
