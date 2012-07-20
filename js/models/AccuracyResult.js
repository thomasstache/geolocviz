define(
	["underscore", "backbone",
	"collections/locationcandidates"],

	function(_, Backbone, LocationCandidateList) {

		var AccuracyResult = Backbone.Model.extend({

			defaults: {
				// id of the original CT message
				msgId: -1,
				// id of the "call" session
				sessionId: -1,
				// reference position
				latLngRef: null,
			},

			initialize: function() {
				// the list of candidate locations from the algorithms
				this.locationCandidates = new LocationCandidateList();
			},
		});

		return AccuracyResult;
	}
);
