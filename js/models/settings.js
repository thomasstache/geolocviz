define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var STORAGE_NAME = "glv-user-settings";
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

				// draw network above result markers
				drawNetworkOnTop: false,

				// use result attributes for dynamic marker colors
				useDynamicMarkerColors: false,
				// the name of the result attribute to use for dynamic marker colors
				markerColorAttribute: "confidence",

				// marker color thresholds
				mobilityThreshold: 0.5,
				indoorThreshold: 0.5,
			},

			initialize: function() {
				this.fetch();
				this.on("change", this.save, this);
			},

			reset: function() {
				this.set(this.defaults);
				this.trigger("reset");
			},

			save: function(attributes) {
				localStorage.setItem(STORAGE_NAME, JSON.stringify(this.toJSON()));
			},

			fetch: function() {
				this.set(JSON.parse(localStorage.getItem(STORAGE_NAME)));
			}
		});

		return Settings;
	}
);
