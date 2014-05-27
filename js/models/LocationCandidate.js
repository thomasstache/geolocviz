define(
	["underscore", "backbone",
	 "models/baseresult"],

	function(_, Backbone, BaseResult) {

		var LocationCandidate = BaseResult.extend({

			defaults: {
				// id of the original CT message
				msgId: -1,
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

			getInfo: function() {

				return {
					num: this.getIndex() + 1,
					resultCount: this.collection.length,
					msgId: this.get('msgId'),
					distance: this.get('distance'),
					confidence: this.get('confidence'),
					probMobility: this.get('probMobility'),
					probIndoor: this.get('probIndoor'),
					isCandidate: true
				};
			}
		});

		return LocationCandidate;
	}
);
