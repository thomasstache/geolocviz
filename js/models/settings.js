define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Settings = Backbone.Model.extend({

			defaults: {
				// connect geolocated and reference markers with lines
				drawReferenceLines: true,
				// connect markers in a session with lines
				drawSessionLines: true,

				// reference markers
				drawMarkers_R: true,
				// markers for mobile
				drawMarkers_M: true,
				// markers for stationary
				drawMarkers_S: true,
				// markers for indoor
				drawMarkers_I: true,
				// markers for candidates
				drawMarkers_C: true,

				// show or hide the map scale control
				showScaleControl: false,
			}
		});

		return Settings;
	}
);
