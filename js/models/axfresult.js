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

				// time offset
				timestamp: 0,
			},

			initialize: function() {

			},

			getInfo: function() {

				var info = this.toJSON();
				info.num = this.collection.indexOf(this) + 1;
				info.resultCount = this.collection.length;
				return info;
			}
		});

		return AxfResult;
	}
);
