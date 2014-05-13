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
				// @type {Position} reference position
				position: null,
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

			/**
			 * Returns the geolocated position.
			 * @return {Position}
			 */
			getGeoPosition: function() {
				return this.getBestLocationCandidate().get('position');
			},

			/**
			 * Returns the reference position.
			 * @return {Position}
			 */
			getRefPosition: function() {
				return this.get('position');
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
					controllerId: bestCand.get('controllerId'),
					primaryCellId: bestCand.get('primaryCellId'),
					candidateCount: this.locationCandidates.length,
				};
			},

			/**
			 * Returns the attributes identifying the serving sector.
			 * @return {Object} a property hash including "primaryCellId" and "controllerId"
			 */
			getSectorProperties: function() {
				var bestCand = this.getBestLocationCandidate();
				return {
					controllerId: bestCand.get('controllerId'),
					primaryCellId: bestCand.get('primaryCellId'),
				};
			}
		});

		return AccuracyResult;
	}
);
