define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Settings = Backbone.Model.extend({

			defaults: {
				// connect geolocated and reference markers with lines
				drawReferenceLines: true,
				// connect markers in a session with lines
				drawSessionLines: true,
			}
		});

		return Settings;
	}
);
