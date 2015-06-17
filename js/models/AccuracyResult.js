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
				refPosition: null,

				// time offset
				timestamp: 0,
			},

			/** @type {LocationCandidateList} collection of LocationCandidates */
			locationCandidates: null,

			constructor: function AccuracyResult() {
				BaseResult.prototype.constructor.apply(this, arguments);
			},

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
				return this.get('refPosition');
			},

			getInfo: function() {
				var info = {
					num: this.getIndex() + 1,
					resultCount: this.collection.length,
					msgId: this.get('msgId'),
					timestamp: this.get('timestamp'),
					refPosition: this.getRefPosition(),
					candidateCount: this.locationCandidates.length,
				};

				// mix in the properties of the best candidate
				var bestCandInfo = this.getBestLocationCandidate().getInfo();

				info = _.defaults(info, bestCandInfo);

				return info;
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
