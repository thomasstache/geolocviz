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

				// allows to suppress mobile/stationary/indoor/outdoor categorization
				categorizeMarkers: true,

				// show or hide the map scale control
				showScaleControl: false,

				// draw network above result markers
				drawNetworkOnTop: false,

				// use attribute for dynamic site colors
				useDynamicSiteColors: false,
				// use channel number for dynamic sector colors
				useDynamicSectorColors: false,

				// use result attributes for dynamic marker colors
				useDynamicMarkerColors: false,
				// the name of the result attribute to use for dynamic marker colors
				markerColorAttribute: "confidence",

				// use dot markers for accuracy results
				useDotAccuracyMarkers: false,

				// marker color thresholds
				mobilityThreshold: 0.5,
				indoorThreshold: 0.5,

				// minimum confidence to show a marker
				confidenceThreshold: 0.0,

				// maximum number of results before a heatmap is forced
				maxResultMarkers: 30000,
				// number of results after which a heatmap is suggested
				heatmapSuggestionThreshold: 15000,
				// the maximum/upper scale limit
				heatmapMaxIntensity: 15,
				// number of pixels data points influence
				heatmapSpreadRadius: 10,

				// target zoom for "focus site"
				focusSiteTargetZoom: 13,
				// max. zoom for "focus session"
				focusSessionMaxZoom: 14,
			},

			constructor: function Settings() {
				Backbone.Model.prototype.constructor.apply(this, arguments);
			},

			initialize: function() {
				this.fetch();
				this.on("change", this.save, this);
			},

			/** Indicates if "extended" settings deviate from their defaults. */
			hasCustomSettings: function() {
				return  this.get("mobilityThreshold") !== this.defaults.mobilityThreshold
					 || this.get("indoorThreshold") !== this.defaults.indoorThreshold
					 || this.get("confidenceThreshold") !== this.defaults.confidenceThreshold;
			},

			/**
			 * Returns an object with the parameters for BaseResult.category()
			 */
			getThresholdSettings: function() {
				var thresholds = {
					confidence: this.get("confidenceThreshold"),
					mobility: this.get("mobilityThreshold"),
					indoor: this.get("indoorThreshold"),
				};
				return thresholds;
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
