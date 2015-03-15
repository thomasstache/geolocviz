define(
	["underscore", "backbone",
	 "models/baseresult", "types/position"],

	function(_, Backbone, BaseResult, Position) {

		var AxfResult = BaseResult.extend({

			defaults: {
				// id of the original CT message
				msgId: -1,
				// id of the "call" session
				sessionId: -1,

				// @type {Position} geolocated position
				position: null,
				// confidence value after the combiner
				confidence: 0.0,
				// mobile session probability as decimal
				probMobility: 0.0,
				// indoor probability as decimal
				probIndoor: 0.0,

				// time offset
				timestamp: 0,

				// @type {Boolean} if the CT message was a "measurement report", i.e. had power values
				isMeasReport: null,

				// (optional) only available in extended .axf files:
				// serving cell controller (WCDMA RNC)
				controllerId: null,
				// id of the serving cell (corresponds to "CI" or "WCDMA_CI")
				primaryCellId: null,

				// reference cell controller (WCDMA RNC)
				refControllerId: null,
				// id of the reference cell (corresponds to "CI" or "WCDMA_CI")
				referenceCellId: null,
				
				// just stored in case we write it back to file
				driveSession: null,
				indoor: null
			},

			constructor: function AxfResult() {
				BaseResult.prototype.constructor.apply(this, arguments);
			},

			initialize: function() {

			},

			getInfo: function() {

				var rv = this.toJSON();
				rv.num = this.getIndex() + 1;
				rv.resultCount = this.collection.length;
				return rv;
			},

			/**
			 * Returns the geolocated position.
			 * @param {Position} value the new position
			 */
			updateGeoPosition: function(value) {
				if (!value instanceof Position)
					return;

				this.set('position', value);
			},

			/**
			 * Returns the attributes identifying the serving sector.
			 * @return {Object} a property hash including "primaryCellId" and "controllerId"
			 */
			getSectorProperties: function() {
				return {
					controllerId: this.get('controllerId'),
					primaryCellId: this.get('primaryCellId'),
					refControllerId: this.get('refControllerId'),
					referenceCellId: this.get('referenceCellId'),
				};
			}
		});

		return AxfResult;
	}
);
