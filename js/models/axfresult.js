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

				// position
				latLng: null,
				// confidence value after the combiner
				confidence: 0.0,
				// mobile session probability as decimal
				probMobility: 0.0,
				// indoor probability as decimal
				probIndoor: 0.0,

				// id of the serving cell
				primaryCellId: -1,
				// time offset
				timestamp: 0,
			},

			initialize: function() {

			},

			getInfo: function() {

				return {
					num: this.collection.indexOf(this) + 1,
					resultCount: this.collection.length,
					msgId: this.get('msgId'),
					confidence: this.get('confidence'),
					probMobility: this.get('probMobility'),
					probIndoor: this.get('probIndoor'),
				};
			}
		});

		return AxfResult;
	}
);
