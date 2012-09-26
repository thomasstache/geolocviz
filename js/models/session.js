define(
	["underscore", "backbone",
	"collections/results"],

	function(_, Backbone, ResultList) {

		var Session = Backbone.Model.extend({

			defaults: {
				// id of the "call" session
				id: -1,
			},

			results: null,

			initialize: function() {
				// the list of geolocation results
				this.results = new ResultList();
			},

			/**
			 * Returns the result with the given CID (Backbone client id), if we have it. Otherwise null.
			 */
			getByCid: function(cid) {
				return this.results.getByCid(cid);
			}
		});

		return Session;
	}
);
