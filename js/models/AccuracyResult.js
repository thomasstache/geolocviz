define(
	["underscore", "backbone",
	 "models/baseresult"],

	function(_, Backbone, BaseResult) {

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

				// @type {Position} geolocated position
				position: null,
				// distance between geolocated and reference position
				distance: 0.0,

				// confidence value after the combiner
				confidence: 0.0,
				// mobile session probability as decimal
				probMobility: 0.0,
				// indoor probability as decimal
				probIndoor: 0.0,

				// (optional) only available in extended .axf files:
				// serving cell controller (WCDMA RNC)
				controllerId: null,
				// id of the serving cell (corresponds to "CI" or "WCDMA_CI")
				primaryCellId: null,
			},

			constructor: function AccuracyResult() {
				BaseResult.prototype.constructor.apply(this, arguments);
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
					isAccuracyResult: true,
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
