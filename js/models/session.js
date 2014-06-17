define(
	["underscore", "backbone",
	"collections/results"],

	function(_, Backbone, ResultList) {

		var Session = Backbone.Model.extend({

			defaults: {
				// id of the "call" session
				sessionId: null,
				// identifier of the calltrace file
				fileId: null
			},

			/** @type {ResultList} collection of results (with base type BaseResult) */
			results: null,

			initialize: function() {
				// the list of geolocation results
				this.results = new ResultList();
			},

			getInfo: function() {
				var rv = this.toJSON();
				rv.resultCount = this.results.length;
				return rv;
			}
		});

		return Session;
	}
);
