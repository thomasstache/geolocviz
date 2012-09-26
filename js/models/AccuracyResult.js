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

			locationCandidates: null,

			initialize: function() {
				// the list of candidate locations from the algorithms
				this.locationCandidates = new LocationCandidateList();
			},

			getBestLocationCandidate: function() {
				return this.locationCandidates.at(0);
			},

			getInfo: function() {
				var bestCand = this.getBestLocationCandidate();
				return {
					num: this.collection.indexOf(this) + 1,
					resultCount: this.collection.length,
					distance: bestCand.get('distance'),
					confidence: bestCand.get('confidence'),
					probMobility: bestCand.get('probMobility'),
					probIndoor: bestCand.get('probIndoor'),
					candidateCount: this.locationCandidates.length,
				};
			}
		});

		return AccuracyResult;
	}
);
