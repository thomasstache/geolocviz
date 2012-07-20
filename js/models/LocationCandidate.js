define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var LocationCandidate = Backbone.Model.extend({

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
		});

		return LocationCandidate;
	}
);
