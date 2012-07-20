define(
	["underscore", "backbone",
	"collections/results"],

	function(_, Backbone, ResultList) {

		var Session = Backbone.Model.extend({

			defaults: {
				// id of the "call" session
				id: -1,
			},

			initialize: function() {
				// the list of candidate locations from the algorithms
				this.results = new ResultList();
			}
		});

		return Session;
	}
);
