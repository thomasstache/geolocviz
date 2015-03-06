define(
	["underscore", "backbone",
	 "views/viewportdialog",
	 "views/map/resultlayer", "views/map/heatmaplayer", "views/map/networklayer",
	 "models/AccuracyResult",
	 "types/position", "types/viewport", "types/resultsfilterquery"],

	function(_, Backbone,
			 ViewportDialog,
			 ResultLayer, HeatmapLayer, NetworkLayer,
			 AccuracyResult, Position, Viewport, ResultsFilterQuery) {

		/**
		 * Validate LatLngs. Returns false if one of the coordinates is NaN.
		 * @param {LatLng} latLng
		 */
		function isValidLatLng(latLng) {
			return !isNaN(latLng.lat()) &&
				   !isNaN(latLng.lng());
		}

		var MapView = Backbone.View.extend({

			el: $("#mapView"),

			/** @type {google.maps.Map} the Google Maps control */
			map: null,

			/** @type {ResultLayer} result marker view */
			resultLayer: null,
			/** @type {HeatmapLayer} heatmap view */
			heatmapLayer: null,
			/** @type {NetworkLayer} the network view */
			networkLayer: null,

			// zoom-to-bounds map control
			$zoomBoundsBtn: null,
			// viewport settings map control
			$viewportSettingsBtn: null,
			// reference to the viewport settings dialog
			viewportDialog: null,

			/** @type {Settings} the application settings */
			appsettings: null,

			/** @type {AppState} the shared application state */
			appstate: null,

			/** @type {SiteList} collection of sites */
			siteList: null,

			/** @type {SessionList} collection of sessions */
			collection: null,

			/** @type {Function} filter function to run result models */
			resultFilterFct: null,

			initialize: function(options) {

				this.appsettings = options.settings;

				try {
					var mapCenter = new google.maps.LatLng(51.049035, 13.73744); // Actix Dresden Location

					// include the custom MapTypeId to add to the map type control.
					var mapOptions = {
						zoom: 16,
						center: mapCenter,
						disableDefaultUI: true,
						zoomControl: true,
						mapTypeControl: true,
						scaleControl: this.appsettings.get("showScaleControl"),
						mapTypeControlOptions: {
							mapTypeIds: [
								STYLED_MAPTYPE_ID,
								// google.maps.MapTypeId.ROADMAP,
								google.maps.MapTypeId.SATELLITE,
								google.maps.MapTypeId.HYBRID,
							]
						},
						mapTypeId: STYLED_MAPTYPE_ID
					};

					google.maps.visualRefresh = true;

					// (from https://developers.google.com/maps/documentation/javascript/styling)
					// Create a new StyledMapType object, passing it the array of styles,
					// as well as the name to be displayed on the map type control.
					var styledMapType = new google.maps.StyledMapType(simpleMapStyles, {name: "Map"});

					// setup Google Maps component
					this.map = new google.maps.Map(this.el, mapOptions);

					//Associate the styled map with the MapTypeId and set it to display.
					this.map.mapTypes.set(STYLED_MAPTYPE_ID, styledMapType);

					this.addMapControl("mapLegend", google.maps.ControlPosition.BOTTOM_CENTER);
					this.addMapControl("filterBar", google.maps.ControlPosition.TOP_CENTER);
					this.addMapControl("zoomBoundsBtn", google.maps.ControlPosition.LEFT_TOP);
					this.addMapControl("btnViewportSettings", google.maps.ControlPosition.LEFT_BOTTOM);

					this.$zoomBoundsBtn = $("#zoomBoundsBtn")
						.on("click", this.zoomToBounds.bind(this));
					this.$viewportSettingsBtn = $("#btnViewportSettings")
						.on("click", this.showViewportSettings.bind(this));

					this.initialized = true;
				}
				catch (e) {
					this.$(".mapMessage").show();
					this.initialized = false;
				}

				this.siteList = options.siteList;
				this.appstate = options.appstate;

				this.listenTo(this.collection, "reset", this.onSessionsReset);

				this.listenTo(this.appsettings, "change:showScaleControl", this.onMapSettingsChanged);

				// give maps time to initialize before showing button
				_.delay(this.enableViewportControls.bind(this), 3000);

				// make available for console scripting
//				window.mapview = this;
			},

			initNetworkLayer: function() {

				this.networkLayer = new NetworkLayer({
					map: this.map,
					appstate: this.appstate,
					settings: this.appsettings,
					collection: this.siteList
				});

				this.listenTo(this.networkLayer, "reset", this.onNetworkLayerReset);
				this.listenTo(this.networkLayer, "site:selected", this.onSiteSelected);
				this.listenTo(this.networkLayer, "sector:selected", this.onSectorSelected);
			},

			initResultLayer: function() {

				this.resultLayer = new ResultLayer({
					mapview: this, // for resultFilterFct
					map: this.map,
					appstate: this.appstate,
					settings: this.appsettings,
					collection: this.collection
				});

				this.listenTo(this.resultLayer, "reset", this.onResultLayerReset);
				this.listenTo(this.resultLayer, "result:selected", this.onResultSelected);
				this.listenTo(this.resultLayer, "session:selected", this.onSessionSelected);
			},

			initHeatmapLayer: function() {

				this.heatmapLayer = new HeatmapLayer({
					mapview: this, // for resultFilterFct
					map: this.map,
					appstate: this.appstate,
					settings: this.appsettings,
					collection: this.collection
				});
			},

			/**
			 * Check for availabitity of the Google Maps API
			 * @return {Boolean} Returns true if the API is available.
			 */
			hasGoogleMaps: function() {
				return (window.google !== undefined &&
						google.maps !== undefined);
			},

			/**
			 * Add an HTML element from the DOM to the map controls
			 * @param {String} elementId         ID of the DOM node
			 * @param {ControlPosition} position One of the ControlPosition constants
			 */
			addMapControl: function(elementId, position) {

				var element = document.getElementById(elementId);
				if (element)
					this.map.controls[position].push(element);
			},

			enableViewportControls: function() {
				if (this.$viewportSettingsBtn)
					this.$viewportSettingsBtn.removeClass("hidden");
			},

			/**
			 * Enables or disables the map zoom controls.
			 * @param  {Boolean} enable True to enable
			 */
			enableZoomControls: function(enable) {

				if (enable === undefined)
					enable = !this.getBounds().isEmpty();

				if (this.$zoomBoundsBtn)
					this.$zoomBoundsBtn.toggleClass("hidden", !enable);
			},

			/**
			 * Returns the bounds to zoom to - could be network or results.
			 * @return {LatLngBounds}
			 */
			getBounds: function() {

				// network or results?
				var bounds;
				if (this.collection.length > 0) {
					bounds = this.appstate.get("heatmapActive") ? this.heatmapLayer.getBounds() : this.resultLayer.getBounds();
				}
				else if (this.networkLayer) {
					bounds = this.networkLayer.getBounds();
				}
				else {
					bounds = new google.maps.LatLngBounds(); // empty dummy bounds
				}

				return bounds;
			},

			/**
			 * Handler for the click on the Zoom-to-bounds button.
			 * Adjusts the viewport center and zoom to fit the currently collected bounds rectangle.
			 */
			zoomToBounds: function() {

				var bounds = this.getBounds();

				if (!bounds.isEmpty())
					this.map.fitBounds(bounds);
			},

			/**
			 * Returns the current filter function for result/heatmap layers.
			 * @return {Function}
			 */
			getResultFilterFunction: function() {
				return this.resultFilterFct;
			},

			/**
			 * We would want to zoom if:
			 * 1. we have results data
			 * 2. AND we are not redrawing with (applying) an active filter
			 */
			shouldZoomToResults: function() {

				var bZoomToResults = this.collection.length > 0 &&
									 this.resultFilterFct === null;

				return bZoomToResults;
			},

			/**
			 * Open the Viewport Settings dialog to allow to manage the map's viewport.
			 */
			showViewportSettings: function() {

				var vp = new Viewport(this.map.getBounds().getCenter(), this.map.getZoom());
				var dialog = new ViewportDialog({
					viewport: vp
				});
				this.listenToOnce(dialog, "viewport:set", this.onViewportApplied);
				this.listenToOnce(dialog, "dialog:cancel", this.onViewportDialogClosed);
				this.viewportDialog = dialog;
			},

			/**
			 * Handler for the ViewportDialog's "viewport:set" event. Update the maps viewport.
			 * @param {Viewport} viewport the viewport settings
			 */
			onViewportApplied: function(viewport) {

				if (viewport !== null) {
					if (isValidLatLng(viewport.center))
						this.map.panTo(viewport.center);
					if (!isNaN(viewport.zoom))
						this.map.setZoom(viewport.zoom);
				}
				this.onViewportDialogClosed();
			},

			/** remove all listeners from the dialog */
			onViewportDialogClosed: function() {
				this.stopListening(this.viewportDialog);
				this.viewportDialog = null;
			},

			/**
			 * Handler for the ResultLayer's result selection event. Proxy/bubble it.
			 */
			onResultSelected: function(data) {

				this.trigger("result:selected", data);
			},

			/**
			 * Handler for the ResultLayer's session selection event. Proxy/bubble it.
			 */
			onSessionSelected: function(data) {

				this.trigger("session:selected", data);
			},

			/**
			 * Handler for the NetworkLayer's site selection event. Proxy/bubble it.
			 */
			onSiteSelected: function(data) {

				this.trigger("site:selected", data);
			},

			/**
			 * Handler for the NetworkLayer's sector selection event. Filter results attributed to that sector.
			 */
			onSectorSelected: function(sector) {

				var query = new ResultsFilterQuery(
					ResultsFilterQuery.TOPIC_PRIMARYCELL,
					sector.get('id'),
					sector.get('netSegment'),
					sector.get('cellIdentity')
				);
				this.filterResultsBySector(query);
			},

			/**
			 * Shows only result markers where the given sector is primary cell, and hides all other result markers.
			 * @param  {ResultsFilterQuery} query
			 */
			filterResultsBySector: function(query) {

				var view = this;

				// unselect session and results
				this.trigger("result:selected", null);
				this.trigger("session:selected", null);

				// short circuit if we don't have results
				if (this.collection.length === 0)
					return;

				this.trigger("results:filtered", query);

				// set a filter function, capturing the sector properties in the closure.
				this.resultFilterFct = function(result) {
					return view.isResultMatchingSector(result, query);
				};

				this.drawHeatmapOrResultMarkers();
			},

			/**
			 * Resets the current filter for results and redraws markers for all results.
			 */
			clearAllResultFilters: function() {

				this.resultFilterFct = null;
				this.drawHeatmapOrResultMarkers();
			},


			/**
			 * Filter function for result models.
			 * @param  {BaseResult} result        Result model
			 * @param  {ResultsFilterQuery} query Filter parameters
			 * @return {Boolean}                  True if result matches serving sector
			 */
			isResultMatchingSector: function(result, query) {

				var rv = false; // excluded by default

				// for AccuracyResults the properties are in the LocationCandidate models
				if (result instanceof AccuracyResult)
					result = result.getBestLocationCandidate();

				if (query.topic === ResultsFilterQuery.TOPIC_PRIMARYCELL) {

					if (result.has('controllerId') && result.has('primaryCellId')) {
						rv = result.get('controllerId') === query.netSegment &&
							 result.get('primaryCellId') === query.cellIdentity;
					}
				}
				else if (query.topic === ResultsFilterQuery.TOPIC_REFERENCECELL) {

					if (result.has('refControllerId') && result.has('referenceCellId')) {
						rv = result.get('refControllerId') === query.netSegment &&
							 result.get('referenceCellId') === query.cellIdentity;
					}
				}
				return rv;
			},


			/**
			 * Listener for "reset" on sessions collection. Removes all result markers.
			 */
			onSessionsReset: function() {

				this.clearAllResultFilters();
			},

			/**
			 * Listener for "reset" on NetworkLayer.
			 */
			onNetworkLayerReset: function() {

				this.enableZoomControls();
			},

			/**
			 * Update map overlay visibility according to current settings.
			 */
			onMapSettingsChanged: function(event) {

				if (event.changed.showScaleControl !== undefined) {
					this.map.setOptions({ scaleControl: event.changed.showScaleControl });
				}
			},



			/**
			 * Drawing stuff
			 */

			/**
			 * Completely redraw the radio network consisting of sites and sectors.
			 * Update the bounding box if no results are loaded.
			 */
			drawNetwork: function() {

				if (!this.hasGoogleMaps())
					return;

				// only zoom to the whole network if we don't have results displayed
				var bZoomToNetwork = this.collection.length === 0;

				if (this.networkLayer === null) {
					this.initNetworkLayer();
				}

				this.networkLayer.draw();

				if (bZoomToNetwork)
					this.zoomToBounds();

				this.enableZoomControls();
			},


			/**
			 * Draws the results on the map.
			 * If the number of results is very large, a heatmap is used.
			 */
			drawResults: function() {

				var stats = this.appstate.get("statistics"),
					resultCount = stats !== undefined ? stats.get("numResults") : 0;

				var useHeatmap = false;

				if (resultCount > this.appsettings.get("maxResultMarkers")) {
					// force heatmap above max. threshold
					useHeatmap = true;
				}
				else if (resultCount > this.appsettings.get("heatmapSuggestionThreshold")) {
					// prompt user if he's okay with a heatmap
					useHeatmap = window.confirm("The loaded data set is very large (" + resultCount + " results).\nWould you like to view it as a heatmap?");
				}

				this.appstate.set({ heatmapActive: useHeatmap });

				this.drawHeatmapOrResultMarkers();
			},

			/**
			 * Draw results as Heatmap or Markers, deleting all existing markers and highlights.
			 */
			drawHeatmapOrResultMarkers: function() {

				if (!this.hasGoogleMaps()) {
					return;
				}

				// update bounds only if we are not drawing with an active filter
				var bZoomToResults = this.shouldZoomToResults();

				if (this.appstate.get("heatmapActive")) {
					this.drawHeatmap();
				}
				else {
					this.drawResultMarkers();
				}

				if (bZoomToResults) {
					this.zoomToBounds();
				}

				this.enableZoomControls();
			},

			/**
			 * Draw results into Heatmap layer.
			 */
			drawHeatmap: function() {

				if (this.heatmapLayer === null) {
					this.initHeatmapLayer();
				}

				this.heatmapLayer.draw();
			},

			/**
			 * Redraw result markers for all sessions in the SessionList collection.
			 */
			drawResultMarkers: function() {

				if (this.resultLayer === null) {
					this.initResultLayer();
				}

				this.resultLayer.draw();
			},
		});


		var STYLED_MAPTYPE_ID = "styled_map";
		var simpleMapStyles = [
			{
				stylers: [
					{ gamma: 2 }
				]
			},
			{
				featureType: "poi",
				stylers: [
					{ visibility: "off" }
				]
			},
			{
				featureType: "road",
				stylers: [
					{ saturation: -25 },
					{ gamma: 1.75 }
				]
			},
			{
				featureType: "road",
				elementType: "labels.text.fill",
				stylers: [
					{ saturation: -75 }
				]
			},
			{
				featureType: "road.local",
				elementType: "labels",
				stylers: [
					{ visibility: "simplified" }
				]
			},
			{
				featureType: "transit",
				elementType: "labels.icon",
				stylers: [
					{ saturation: -100 }
				]
			}
		];

		return MapView;
	}
);
