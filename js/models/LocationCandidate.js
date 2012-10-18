define(
	["underscore", "backbone",
	 "models/baseresult"],

	function(_, Backbone, BaseResult) {

		var LocationCandidate = BaseResult.extend({

			defaults: {
				// geolocated position
				latLng: null,
				// distance between geolocated and reference position
				distance: 0.0,

				// confidence value after the combiner
				confidence: 0.0,
				// mobile session probability as decimal
				probMobility: 0.0,
				// indoor probability as decimal
				probIndoor: 0.0,
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
