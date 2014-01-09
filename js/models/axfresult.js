define(
	["underscore", "backbone",
	 "models/baseresult"],

	function(_, Backbone, BaseResult) {

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

				// id of the controller (WCDMA RNC)
				// (optional) only available in extended .axf files
				controllerId: null,
				// id of the serving cell (corresponds to "CI" or "WCDMA_CI")
				// (optional) only available in extended .axf files
				primaryCellId: null,

				// time offset
				timestamp: 0,
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

		return AxfResult;
	}
);
