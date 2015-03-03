define(
	["underscore", "backbone",
	 "models/session", "models/axfresult",
	 "types/position", "types/resultsfilterquery", "types/googlemapsutils"],

	function(_, Backbone,
			 Session, AxfResult,
			 Position, ResultsFilterQuery, GoogleMapsUtils) {

		/**
		 * Result Heatmap Map Layer.
		 * Emits the following events:
		 *   reset
		 */
		var HeatmapLayer = Backbone.View.extend({

			/** @type {MapView} the parent view */
			mapview: null,

			/** @type {google.maps.Map} the Google Maps control */
			map: null,

			/** @type {google.maps.visualization.HeatmapLayer} heatmap visualization layer */
			heatmapLayer: null,

			/** @type {AppState} the shared app state */
			appstate: null,
			/** @type {Settings} the settings model */
			settings: null,

			// bounding rectangle around all reference and geolocated markers
			bounds: null,

			initialize: function(options) {

				this.settings = options.settings;
				this.appstate = options.appstate;
				this.mapview = options.mapview;
				this.map = options.map;

				// Initialize and configure the heatmap visualization layer.
				this.heatmapLayer = new google.maps.visualization.HeatmapLayer({
					map: this.map,
					dissipating: true,
					maxIntensity: this.settings.get("heatmapMaxIntensity"),
					radius: this.settings.get("heatmapSpreadRadius"),
					opacity: 0.8,
				});

				this.resetBounds();

				this.collection.on("reset", this.onSessionsReset, this);

				// listen for settings changes
				this.listenTo(this.settings, "change:heatmapMaxIntensity change:heatmapSpreadRadius", this.heatmapSettingsChanged);
				this.listenTo(this.settings, "change:confidenceThreshold", this.confidenceThresholdChanged);
			},

			/**
			 * Draw results into Heatmap layer.
			 */
			draw: function() {

				var view = this,
					thresholds = this.settings.getThresholdSettings();

				// collect all positions
				var heatmapData = [];
				this.collection.each(function(session) {
					heatmapData.push(view.getHeatmapDataForSession(session, thresholds));
				});
				// convert 2D array of arrays to 1D
				heatmapData = _.flatten(heatmapData);

				this.heatmapLayer.setData(heatmapData);
			},

			getBounds: function() {
				return this.bounds;
			},

			/**
			 * Resets the view bounds rectangle
			 */
			resetBounds: function() {
				this.bounds = new google.maps.LatLngBounds();
			},

			deleteHeatmapData: function() {
				if (this.heatmapLayer)
					this.heatmapLayer.setData([]);
			},

			/**
			 * Update map heatmap layer according to current settings.
			 */
			heatmapSettingsChanged: function(event) {

				if (!this.heatmapLayer)
					return;

				if (event.changed.heatmapMaxIntensity !== undefined) {
					this.heatmapLayer.set("maxIntensity", event.changed.heatmapMaxIntensity);
				}
				if (event.changed.heatmapSpreadRadius !== undefined) {
					this.heatmapLayer.set("radius", event.changed.heatmapSpreadRadius);
				}
			},

			confidenceThresholdChanged: function() {

				if (this.mapview.shouldZoomToResults())
					this.resetBounds();

				this.draw();
			},

			onSessionsReset: function() {

				this.deleteHeatmapData();
				this.resetBounds();

				this.trigger("reset");
			},

			/**
			 * Returns the positions of the session's results for heatmap visualizations.
			 * @param {Session} session
			 * @param {Object} thresholds Indoor/mobility probability thresholds
			 * @return {Array}
			 */
			getHeatmapDataForSession: function(session, thresholds) {

				var rv = [],
					latLng = null,
					bounds = this.bounds,
					resultFilterFct = this.mapview.getResultFilterFunction(),
					firstResult = session.results.first();

				// get results above confidence threshold
				var resultsToConsider;
				if (thresholds.confidence > 0.0) {
					resultsToConsider = session.results.filter(
						function filterFct(result) {
							return result.get("confidence") > thresholds.confidence;
						}
					);
				}
				else {
					resultsToConsider = session.results.toArray();
				}

				// check if the results match the current filter
				if (resultFilterFct !== null) {
					resultsToConsider = _.filter(resultsToConsider, resultFilterFct);
				}

				if (resultsToConsider.length === 0)
					return rv;

				// check if we had extended Axf files, i.e. this is not the only default/dummy session
				var validSessions = session.get("sessionId") !== Session.ID_DUMMY;

				// for stationary sessions we can return one WeightedLocation
				if (validSessions &&
					firstResult.category(thresholds) === 'S' &&
					resultsToConsider.length > 1) {

					latLng = GoogleMapsUtils.makeLatLng(firstResult.getGeoPosition());
					bounds.extend(latLng);
					rv.push({
						location: latLng,
						weight: resultsToConsider.length
					});
				}
				else {

					rv = _.map(resultsToConsider, function(result) {
						latLng = GoogleMapsUtils.makeLatLng(result.getGeoPosition());
						bounds.extend(latLng);
						return latLng;
					});
				}

				return rv;
			},

		});

		return HeatmapLayer;
	}
);
