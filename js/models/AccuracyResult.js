define(
	["underscore", "backbone",
	 "models/baseresult", "collections/locationcandidates"],

	function(_, Backbone, BaseResult, LocationCandidateList) {

		var AccuracyResult = BaseResult.extend({

			defaults: {
				// id of the original CT message
				msgId: -1,
				// id of the "call" session
				sessionId: -1,
				// reference position
				latLng: null,
			},

			/** @type {LocationCandidateList} collection of LocationCandidates */
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
					num: this.getIndex() + 1,
					resultCount: this.collection.length,
					msgId: this.get('msgId'),
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
