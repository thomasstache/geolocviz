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

				// attributes of best LocationCandidate:
				position: null,
				distance: 0.0,

				confidence: 0.0,
				probMobility: 0.0,
				probIndoor: 0.0,

				controllerId: null,
				primaryCellId: null,
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

			/**
			 * Add a candidate for this result.
			 * @param {Object} candidateProps Attribute hash, will be passed to Backbone.Collection.add()
			 * @param {Object} addOptions     Options for Backbone.Collection.add()
			 */
			addLocationCandidate: function(candidateProps, addOptions) {

				if (this.locationCandidates.length === 0) {
					// first (best) candidate. Store properties on ourself, too.
					this.set(candidateProps);
				}
				this.locationCandidates.add(candidateProps, addOptions);
			},

			/**
			 * Returns the geolocated position.
			 * @return {Position}
			 */
			getGeoPosition: function() {
				return this.get('position');
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
					candidateCount: this.locationCandidates.length,
				};

				info = _.defaults(info, this.toJSON());

				return info;
			},

			/**
			 * Returns the attributes identifying the serving sector.
			 * @return {Object} a property hash including "primaryCellId" and "controllerId"
			 */
			getSectorProperties: function() {

				return {
					controllerId: this.get('controllerId'),
					primaryCellId: this.get('primaryCellId'),
				};
			}
		});

		return AccuracyResult;
	}
);
