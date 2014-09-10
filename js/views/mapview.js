define(
	["underscore", "backbone",
	 "views/viewportdialog",
	 "collections/overlays",
	 "models/AccuracyResult", "models/axfresult", "models/sector",
	 "types/position", "types/viewport", "types/resultsfilterquery", "types/googlemapsutils", "ColorMapper"],
	function(_, Backbone,
			 ViewportDialog, OverlayList, AccuracyResult, AxfResult, Sector,
			 Position, Viewport, ResultsFilterQuery, GoogleMapsUtils, ColorMapper) {

		// marker types 'n colors
		var MarkerColors = Object.freeze({
			REFERENCE:	{ bgcolor: "0000FF", color: "FFFFFF", smb: "R", label: "Reference Marker" }, // blue
			GEOLOCATED: { bgcolor: "FF0000", color: "FFFFFF", smb: "M", label: "Mobile" }, // red
			STATIONARY: { bgcolor: "FF9900", color: "000000", smb: "S", label: "Stationary" }, // orange
			INDOOR:		{ bgcolor: "FBEC5D", color: "000000", smb: "I", label: "Indoor" }, // yellow
			CANDIDATE:	{ bgcolor: "CCFFFF", color: "000000", smb: "C", label: "Location Candidate" }, // skyblue
			/*ACTIX:		{ bgcolor: "006983", color: "CCCCCC", smb: "A", label: "Home" },*/
		});

		var SectorColors = Object.freeze({
			DEFAULT: { color: "#333", fillcolor: "#6AF" },
			SMLCELL:  { color: "#5B720E", fillcolor: "#B5E61D" }, /* green*/
			INDOOR:  { color: "#A349A4", fillcolor: "#C878E7"}, /* violet */
		});

		var IconTypes = Object.freeze({
			PIN: "pin",
			DOT: "dot",
			DYNAMIC: "dynamic",
			SITE: "site",
		});

		var OverlayTypes = Object.freeze({
			SITE: "siteSymbol",
			SECTOR: "sectorSymbol",
			REFERENCEMARKER: "refMarker",
			GEOLOCMARKER: "geoMarker",
			AXFMARKER: "axfMarker",
			CANDIDATEMARKER: "candidateMarker",
			REFERENCELINE: "refLine",
			SESSIONLINE: "sessionLine",
			SELECTIONVIZ: "selectionViz",
			DEBUG: "debug"
		});

		var Z_Index = Object.freeze({
			HIGHLIGHT: -10, // TS: only negative values really put the highlight under the result markers
			SITE: 10,
			SECTOR: 20,
			RESULT: 100,
			ONTOP: 200, // additional offset to bump markers to top
		});

		// The initial scale for sector symbols, basis for adaptive scaling of overlapping symbols.
		var DEFAULT_SECTOR_SCALE = 2.0;

		// "map" of already created Marker icons by type
		var IconCache = {};

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

			/** @type {google.maps.visualization.HeatmapLayer} heatmap visualization layer */
			heatmapLayer: null,

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

			// bounding rectangle around all reference and geolocated markers
			bounds: null,

			/** @type {OverlayList} collection of all map objects */
			overlays: null,

			/** @type {SiteList} collection of sites */
			siteList: null,

			/** @type {Function} filter function to run result models */
			resultFilterFct: null,

			// reference to the overlay used to highlight result markers
			selectedMarkerHighlight: null,
			selectedReferenceMarkerHighlight: null,
			selectedReferenceLineHighlight: null,

			/** @type {Marker} reference to overlay used to highlight the selected site */
			selectedSiteHighlight: null,

			// id of the currently highlighted session (see drawSessionLines())
			highlightedSessionId: -1,

			// cid of the sample/result for which candidate markers are drawn (see drawCandidateMarkers())
			highlightedCandidateSampleCid: -1,

			// offset applied to the z-index of site/sector markers according to 'drawNetworkOnTop' setting
			networkMarkerZOffset: 0,

			// maps the values to colors
			colorMapper: null,

			// returns the colors dictionary
			colors: function() { return MarkerColors; },

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

					this.resetBounds();

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

				// a collection to keep our overlays in sight
				this.overlays = new OverlayList();

				this.siteList = options.siteList;
				this.siteList.on("reset", this.deleteNetworkOverlays, this);

				this.collection.on("reset", this.onSessionsReset, this);

				// listen for settings changes
				this.listenTo(this.appsettings, "change:heatmapMaxIntensity change:heatmapSpreadRadius", this.updateHeatmapSettings);
				this.appsettings.on("change:useDynamicMarkerColors change:mobilityThreshold change:indoorThreshold change:useDotAccuracyMarkers", this.updateMarkerColors, this);
				this.appsettings.on("change", this.onSettingsChanged, this);

				this.appstate = options.appstate;

				this.setNetworkOnTop(this.appsettings.get("drawNetworkOnTop"));

				// give maps time to initialize before showing button
				_.delay(this.enableViewportControls.bind(this), 3000);

				// make available for console scripting
//				window.mapview = this;
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
			 * Initialize and configure the heatmap visualization layer.
			 */
			initHeatmap: function() {

				if (this.initialized && this.heatmapLayer === null) {

					this.heatmapLayer = new google.maps.visualization.HeatmapLayer({
						map: this.map,
						dissipating: true,
						maxIntensity: this.appsettings.get("heatmapMaxIntensity"),
						radius: this.appsettings.get("heatmapSpreadRadius"),
						opacity: 0.8,
					});
					// for playing with the settings
					window.heatmap = this.heatmapLayer;
				}
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
					enable = !this.bounds.isEmpty();

				if (this.$zoomBoundsBtn)
					this.$zoomBoundsBtn.toggleClass("hidden", !enable);
			},

			/**
			 * Resets the view bounds rectangle
			 */
			resetBounds: function() {
				this.bounds = new google.maps.LatLngBounds();
			},

			/**
			 * Adjusts the view bounds rectangle to fit the network sites.
			 * Use e.g. after clearing results
			 */
			updateBoundsToNetwork: function() {
				this.resetBounds();

				var view = this;
				this.siteList.each(function(site) {
					var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));

					if (isValidLatLng(latLng))
						view.bounds.extend(latLng);
				});

				this.enableZoomControls();
			},

			/**
			 * Adjusts the viewport center and zoom to fit the currently collected bounds rectangle.
			 */
			zoomToBounds: function() {

				if (!this.bounds.isEmpty())
					this.map.fitBounds(this.bounds);
			},

			/** debug code to visualize the current bounds as a rectangle */
			debugBounds: function() {
				this.drawRectangle(this.bounds, "#00FF00");
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
			 * Overlay handling
			 */

			/**
			 * Update the z-index of the given marker according to the current "on top" offset.
			 * @param {Marker} marker  Google Maps Marker or Polyline object
			 * @param {Number} zIndex
			 */
			setMarkerZIndex: function(marker, zIndex) {
				if (marker)
					marker.setZIndex(zIndex + this.networkMarkerZOffset);
			},

			/**
			 * Change the z-index offset for network markers and updates all existing markers.
			 * @param {Boolean} drawNetworkOnTop True for "on top", false for below.
			 */
			setNetworkOnTop: function(drawNetworkOnTop) {
				this.networkMarkerZOffset = drawNetworkOnTop ? Z_Index.ONTOP : 0;
				this.updateZIndexForNetworkOverlays();
			},

			/**
			 * Updates the z-index for all network overlays.
			 */
			updateZIndexForNetworkOverlays: function() {

				var sites = this.overlays.byType(OverlayTypes.SITE),
				    sectors = this.overlays.byType(OverlayTypes.SECTOR),
				    overlays = sites.concat(sectors);

				var view = this;

				_.each(
					overlays,
					function(overlay) {
						var marker = overlay.get('ref'),
						    zIndex = overlay.get('type') === OverlayTypes.SITE ? Z_Index.SITE : Z_Index.SECTOR;
						view.setMarkerZIndex(marker, zIndex);
					}
				);

				if (this.selectedSiteHighlight) {
					this.setMarkerZIndex(this.selectedSiteHighlight, Z_Index.SITE + 10);
				}
			},

			/**
			 * Update the visibility of the given marker.
			 * @param {Marker}  marker   Google Maps Marker or Polyline object
			 * @param {Boolean} bVisible
			 */
			setMarkerVisible: function(marker, bVisible) {
				if (marker)
					marker.setMap(bVisible ? this.map : null);
			},

			/**
			 * Update the visibility of all overlays in the given array.
			 * @param {Array}   overlays The list of Overlay models
			 * @param {Boolean} bVisible
			 */
			setOverlaysVisible: function(overlays, bVisible) {

				// make ref to capture in inner function
				var view = this;

				_.each(
					overlays,
					function(overlay) {
						var marker = overlay.get('ref');
						view.setMarkerVisible(marker, bVisible);
					}
				);
			},

			/**
			 * Update the visibility of all overlays that match the custom filter criterium.
			 * @param {Function} filterFct The callback function for _.filter()
			 * @param {Boolean}  bShow     True to show, false to hide
			 */
			showOverlaysForFilter: function(filterFct, bShow) {

				if (typeof filterFct === "function") {

					// get array of overlays that match the filter function
					var overlays = this.overlays.filter(filterFct);

					this.setOverlaysVisible(overlays, bShow);
				}
			},

			/**
			 * Update the visibility of all overlays registered under the given type.
			 * @param {OverlayTypes} type  Overlay type
			 * @param {Boolean}      bShow True to show, false to hide
			 */
			showOverlaysForType: function(type, bShow) {

				var overlays = this.overlays.byType(type);
				this.setOverlaysVisible(overlays, bShow);
			},

			/**
			 * Update visibility of results markers with the given MarkerColor
			 * @param {MarkerColors} colorDef Defines the category
			 * @param {Boolean}      bShow    True to show, false to hide
			 */
			showMarkersForCategory: function(colorDef, bShow) {

				// get all geoloc + axf markers
				var overlays = this.overlays.filter(
					function flt(overlay) {
						var type = overlay.get('type');
						return (type === OverlayTypes.GEOLOCMARKER ||
								type === OverlayTypes.AXFMARKER) &&
								overlay.get('category') === colorDef.smb;
					}
				);

				this.setOverlaysVisible(overlays, bShow);
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

				// draw overlays
				this.drawResultMarkers();
			},

			/**
			 * Resets the current filter for results and redraws markers for all results.
			 */
			clearAllResultFilters: function() {

				this.resultFilterFct = null;
				this.drawResultMarkers();
			},

			/**
			 * Removes all overlays from the map and destroys them.
			 */
			deleteAllOverlays: function() {

				this.overlays.removeAll();
				this.resetBounds();
				this.deleteHeatmapData();

				this.highlightedSessionId = -1;
				this.highlightedCandidateSampleCid = -1;

				this.selectedMarkerHighlight = null;
				this.selectedReferenceMarkerHighlight = null;
				this.selectedReferenceLineHighlight = null;

				this.selectedSiteHighlight = null;
			},

			/**
			 * Removes all site/sector overlays from the map.
			 */
			deleteNetworkOverlays: function() {

				this.highlightSite(null);
				this.deleteOverlaysForType(OverlayTypes.SITE);
				this.deleteOverlaysForType(OverlayTypes.SECTOR);
			},

			/**
			 * Removes all result + session overlays from the map.
			 */
			deleteResultOverlays: function() {

				function filterFct(overlay) {

					var type = overlay.get('type');
					return (type === OverlayTypes.GEOLOCMARKER ||
							type === OverlayTypes.AXFMARKER ||
							type === OverlayTypes.REFERENCEMARKER ||
							type === OverlayTypes.CANDIDATEMARKER ||
							type === OverlayTypes.SESSIONLINE ||
							type === OverlayTypes.REFERENCELINE);
				}

				var list = this.overlays.filter(filterFct);
				this.deleteOverlays(list);

				this.highlightedSessionId = -1;
				this.highlightedCandidateSampleCid = -1;

				this.highlightResult(null);
			},

			/**
			 * Removes all overlays with the given type from the map and destroys them.
			 * @param {OverlayTypes} type
			 */
			deleteOverlaysForType: function(type) {

				var items = this.overlays.byType(type);
				this.deleteOverlays(items);
			},

			/**
			 * Removes the given overlays from the map and destroys them.
			 * @param {Array} list The overlays to delete
			 */
			deleteOverlays: function(list) {

				_.each(list, function(overlay) { overlay.removeFromMap(); });
				this.overlays.remove(list);
			},

			deleteHeatmapData: function() {
				if (this.heatmapLayer)
					this.heatmapLayer.setData([]);
			},

			/**
			 * Store a reference to the maps overlay object by type.
			 * @param {OverlayTypes} type The type of the overlay
			 * @param {Overlay} overlay   The GoogleMaps overlay object. One of {Marker/Line/Polyline}
			 * @param {String}  category  (optional) for results we can store the category for filtering.
			 */
			registerOverlay: function(type, overlay, category) {
				this.overlays.add({
					type: type,
					category: category,
					ref: overlay
				}, { silent: true });
			},

			/**
			 * Filter function for result markers.
			 * @param  {Overlay} overlay The model to check
			 * @return {Boolean}         True if this is a result marker overlay
			 */
			isResultMarker: function(overlay) {

				var type = overlay.get('type');
				return (type === OverlayTypes.GEOLOCMARKER ||
						type === OverlayTypes.AXFMARKER ||
						type === OverlayTypes.REFERENCEMARKER);
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

				this.deleteResultOverlays();
				this.clearAllResultFilters();
				this.deleteHeatmapData();
			},

			/**
			 * Update map overlay visibility according to current settings.
			 */
			onSettingsChanged: function(event) {

				if (event.changed.drawReferenceLines !== undefined) {
					// show or hide reference lines
					this.showOverlaysForType(OverlayTypes.REFERENCELINE, event.changed.drawReferenceLines);
				}

				if (event.changed.drawSessionLines !== undefined) {
					// show or hide session lines
					this.showOverlaysForType(OverlayTypes.SESSIONLINE, event.changed.drawSessionLines);
				}

				if (event.changed.drawMarkers_R !== undefined) {
					this.showOverlaysForType(OverlayTypes.REFERENCEMARKER, event.changed.drawMarkers_R);
				}
				if (event.changed.drawMarkers_C !== undefined) {
					this.showOverlaysForType(OverlayTypes.CANDIDATEMARKER, event.changed.drawMarkers_C);
				}

				// mobile/stationary/indoor are "categories" of AXF/GEOLOCMARKER markers
				if (event.changed.drawMarkers_M !== undefined) {
					this.showMarkersForCategory(MarkerColors.GEOLOCATED, event.changed.drawMarkers_M);
				}
				if (event.changed.drawMarkers_S !== undefined) {
					this.showMarkersForCategory(MarkerColors.STATIONARY, event.changed.drawMarkers_S);
				}
				if (event.changed.drawMarkers_I !== undefined) {
					this.showMarkersForCategory(MarkerColors.INDOOR, event.changed.drawMarkers_I);
				}

				if (event.changed.showScaleControl !== undefined) {
					this.map.setOptions({ scaleControl: event.changed.showScaleControl });
				}

				if (event.changed.markerColorAttribute !== undefined) {
					this.markerAttributeChanged(event.changed.markerColorAttribute);
				}

				if (event.changed.drawNetworkOnTop !== undefined) {
					this.setNetworkOnTop(event.changed.drawNetworkOnTop);
				}
			},

			markerAttributeChanged: function(attributeName) {

				this.configureColorMapperForAttribute(attributeName);
				// redraw markers
				if (this.appsettings.get("useDynamicMarkerColors"))
					this.updateMarkerColors();
			},

			/**
			 * Update map heatmap layer according to current settings.
			 */
			updateHeatmapSettings: function(event) {

				if (!this.heatmapLayer)
					return;

				if (event.changed.heatmapMaxIntensity !== undefined) {
					this.heatmapLayer.set("maxIntensity", event.changed.heatmapMaxIntensity);
				}
				if (event.changed.heatmapSpreadRadius !== undefined) {
					this.heatmapLayer.set("radius", event.changed.heatmapSpreadRadius);
				}
			},



			/**
			 * Drawing stuff
			 */

			// Draw the radio network consisting of sites and sectors
			drawNetwork: function() {

				if (!this.hasGoogleMaps())
					return;

				// only zoom to the whole network if we don't have results displayed
				var bZoomToNetwork = this.collection.length === 0;

				if (bZoomToNetwork)
					this.resetBounds();

				// capture the "this" scope
				var view = this;
				this.siteList.each(function(site) {
					view.drawSite(site, bZoomToNetwork);
				});

				if (bZoomToNetwork)
					this.zoomToBounds();

				this.enableZoomControls();
			},

			/**
			 * Creates a marker for a site and adds it to the map.
			 * @param  {Site}    site           The model for the site
			 * @param  {Boolean} bZoomToNetwork Controls whether the current bounds should be updated
			 */
			drawSite: function(site, bZoomToNetwork) {

				var view = this;
				var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));

				// helper function to collect and format tooltip data
				function makeTooltip(site) {

					var lines = site.getSectors().map(function(sector){
						return sector.getTooltipText();
					});
					lines.unshift(site.get('id'));
					return lines.join("\n");
				}

				if (isValidLatLng(latLng)) {

					if (bZoomToNetwork)
						this.bounds.extend(latLng);

					var marker = new google.maps.Marker({
						icon: this.getMarkerIcon(IconTypes.SITE),
						position: latLng,
						map: this.map,
						title: makeTooltip(site),
						zIndex: Z_Index.SITE + this.networkMarkerZOffset
					});
					marker.metaData = {
						model: site
					};
					this.registerOverlay(OverlayTypes.SITE, marker);

					// click event to the for the marker
					google.maps.event.addListener(marker, 'click',
						function() {
							// in here "this" is bound to the marker
							view.onSiteClick(this);
						}
					);
				}
			},

			/**
			 * Creates markers for all sectors in the site's SectorList.
			 * The markers are drawn using SVG symbol paths.
			 * @param  {Site} site
			 */
			drawSectorsForSite: function(site) {

				if (site &&
					site.getSectors().length > 0) {

					var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));
					if (isValidLatLng(latLng)) {

						var sectors = site.getSectorsSortedBy('azimuth');
						var lastAzimuth = NaN;
						var scale = DEFAULT_SECTOR_SCALE;

						for (var i = 0; i < sectors.length; i++) {

							var sector = sectors[i];
							var azimuth = sector.get('azimuth');

							// increase the symbol scale if the sector has the same azimuth as the one before
							if (azimuth === lastAzimuth)
								scale += 1.0;
							else
								scale = DEFAULT_SECTOR_SCALE;

							lastAzimuth = azimuth;

							this.drawSector(sector, latLng, scale);
						}
					}
				}
			},

			/**
			 * Draw a symbol for the given sector.
			 * @param  {Sector} sector     The model with the sector's data
			 * @param  {LatLng} siteLatLng The location of the parent site
			 * @param  {Number} scale      (optional) Scaling factor for the symbol size
			 */
			drawSector: function(sector, siteLatLng, scale) {

				var view = this;

				var _scale = scale || DEFAULT_SECTOR_SCALE;
				var azi = sector.get('azimuth');

				var colorDef;
				var cellType = sector.get('cellType');
				if (cellType == Sector.TYPE_INDOOR) {
					colorDef = SectorColors.INDOOR;
				}
				else if (cellType == Sector.TYPE_SMALLCELL) {
					colorDef = SectorColors.SMLCELL;
				}
				else {
					colorDef = SectorColors.DEFAULT;
				}

				var marker = new google.maps.Marker({

					icon: {
						path: "M0,0 l0,-6 -1,0 1,-4 1,4 -1,0",
						rotation: azi,
						fillColor: colorDef.fillcolor,
						fillOpacity: 1,
						scale: _scale,
						strokeColor: colorDef.color,
						strokeOpacity: "0.6",
						strokeWeight: 2,
					},
					position: siteLatLng,
					map: this.map,
					title: sector.getTooltipText(),
					zIndex: Z_Index.SECTOR + this.networkMarkerZOffset - _scale // the bigger the symbol, the lower we place it
				});

				marker.metaData = {
					model: sector
				};

				// click event to the for the marker
				google.maps.event.addListener(marker, 'dblclick',
					function() {
						view.onSectorDblClick(this);
					}
				);

				this.registerOverlay(OverlayTypes.SECTOR, marker);
			},

			/**
			 * Configures ColorMapper for the attribute.
			 * @param  {String} attributeName
			 */
			configureColorMapperForAttribute: function(attributeName) {

				var colorMapper = null;
				// TODO: need to manage legend limits using a map by attribute
				if (attributeName === "confidence")
					colorMapper = new ColorMapper(0.0, 1.0);
				else if (attributeName === "probMobility")
					colorMapper = new ColorMapper(0.0, 1.0);
				else if (attributeName === "probIndoor")
					colorMapper = new ColorMapper(0.0, 1.0);

				this.appstate.set("markerColorMapper", colorMapper);
				this.colorMapper = colorMapper;
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

				if (useHeatmap) {
					this.drawHeatmap();
					this.appstate.set({ heatmapActive: true });
				}
				else {
					this.drawResultMarkers();
					this.appstate.set({ heatmapActive: false });
				}
			},

			/**
			 * Draw results into Heatmap layer.
			 */
			drawHeatmap: function() {

				if (!this.hasGoogleMaps())
					return;

				this.deleteResultOverlays();
				this.resetBounds();

				this.initHeatmap();

				var view = this,
					thresholds = this.getThresholdSettings();

				// collect all positions
				var heatmapData = [];
				this.collection.each(function(session) {
					heatmapData.push(session.getPositionsForHeatmap(view.bounds, thresholds));
				});
				// convert 2D array of arrays to 1D
				heatmapData = _.flatten(heatmapData);

				this.heatmapLayer.setData(heatmapData);

				this.zoomToBounds();

				this.enableZoomControls();
			},

			/**
			 * Redraw result markers for all sessions, deleting all existing markers and highlights.
			 */
			drawResultMarkers: function() {

				if (!this.hasGoogleMaps())
					return;

				// clear all result markers
				this.deleteResultOverlays();

				// update bounds if:
				// 1. we have results data
				// 2. AND we are not redrawing with (applying) an active filter
				var bZoomToResults = this.collection.length > 0 &&
									 this.resultFilterFct === null;

				if (bZoomToResults)
					this.resetBounds();

				this.drawSessions();

				if (bZoomToResults)
					this.zoomToBounds();

				this.enableZoomControls();
			},

			/**
			 * Draw result markers for all sessions in the SessionList collection.
			 */
			drawSessions: function() {

				// initialize the color mapper
				if ( this.appsettings.get("useDynamicMarkerColors") &&
					!this.appstate.has("markerColorMapper")) {

					this.configureColorMapperForAttribute(this.appsettings.get("markerColorAttribute"));
				}

				// capture the "this" scope
				var view = this;
				this.collection.each(function(session) {
					view.drawSession(session);
				});
			},

			/**
			 * Returns an object with the parameters for BaseResult.category()
			 */
			getThresholdSettings: function() {
				var thresholds = {
					mobility: this.appsettings.get("mobilityThreshold"),
					indoor: this.appsettings.get("indoorThreshold"),
				};
				return thresholds;
			},

			/**
			 * Draw markers for results in the given session matching the current filter
			 * @param  {Session} session The session model.
			 */
			drawSession: function(session) {

				var view = this;

				var thresholds = this.getThresholdSettings();

				var refLinesEnabled = this.appsettings.get("drawReferenceLines");

				session.results.each(function(sample) {

					var color = null, visible = true;

					// check if the result sample matches the current filter
					if (view.resultFilterFct !== null &&
						view.resultFilterFct(sample) === false)
						return;

					if (sample instanceof AccuracyResult) {
						var refLoc = GoogleMapsUtils.makeLatLng(sample.get('position'));

						// some sample files contain "NaN" coordinates. using them messes up the map and the bounding box.
						if (isValidLatLng(refLoc)) {

							view.bounds.extend(refLoc);

							view.createMarker(OverlayTypes.REFERENCEMARKER,
											  refLoc,
											  "#" + sample.get('msgId'),
											  MarkerColors.REFERENCE,
											  view.appsettings.get("drawMarkers_R"),
											  sample);
						}

						var bestCand = sample.getBestLocationCandidate();
						var bestLoc = GoogleMapsUtils.makeLatLng(bestCand.get('position'));

						switch (bestCand.category(thresholds)) {
							case "S":
								color = MarkerColors.STATIONARY;
								visible = view.appsettings.get("drawMarkers_S");
								break;
							case "I":
							case "IM":
								color = MarkerColors.INDOOR;
								visible = view.appsettings.get("drawMarkers_I");
								break;
							case "M":
							default:
								color = MarkerColors.GEOLOCATED;
								visible = view.appsettings.get("drawMarkers_M");
								break;
						}

						view.createMarker(OverlayTypes.GEOLOCMARKER,
										  bestLoc,
										  "#" + sample.get('msgId'),
										  color,
										  visible,
										  sample);

						view.bounds.extend(bestLoc);

						// connect measured and calculated points with lines
						view.drawReferenceLine(refLoc, bestLoc, refLinesEnabled);
					}
					else if (sample instanceof AxfResult) {

						var location = GoogleMapsUtils.makeLatLng(sample.get('position'));
						switch (sample.category(thresholds)) {
							case "S":
								color = MarkerColors.STATIONARY;
								visible = view.appsettings.get("drawMarkers_S");
								break;
							case "I":
							case "IM":
								color = MarkerColors.INDOOR;
								visible = view.appsettings.get("drawMarkers_I");
								break;
							case "M":
								color = MarkerColors.GEOLOCATED;
								visible = view.appsettings.get("drawMarkers_M");
								break;
						}

						view.createMarker(OverlayTypes.AXFMARKER,
										  location,
										  "#" + sample.get('msgId'),
										  color,
										  visible,
										  sample);

						view.bounds.extend(location);
					}
				});
			},

			/**
			 * Draws markers for all candidate locations for the AccuracyResult.
			 * @param {AccuracyResult} sample
			 */
			drawCandidateMarkers: function(sample) {

				if (!(sample instanceof AccuracyResult))
					return;

				if (this.highlightedCandidateSampleCid != sample.cid) {

					// remove old markers
					this.deleteCandidateMarkers();

					this.highlightedCandidateSampleCid = sample.cid;

					var visible = this.appsettings.get("drawMarkers_C");
					// start at "1" to skip best candidate
					for (var i = 1; i < sample.locationCandidates.length; i++) {

						var candidate = sample.locationCandidates.at(i);
						var latLng = GoogleMapsUtils.makeLatLng(candidate.get('position'));
						this.createMarker(OverlayTypes.CANDIDATEMARKER,
										  latLng,
										  "#" + sample.get('msgId'),
										  MarkerColors.CANDIDATE,
										  visible,
										  sample,
										  candidate);
					}
				}
			},

			deleteCandidateMarkers: function() {

				this.deleteOverlaysForType(OverlayTypes.CANDIDATEMARKER);
				this.highlightedCandidateSampleCid = -1;
			},

			/**
			 * Creates a marker and adds it to the map.
			 * @param {OverlayTypes}      type      The type of the marker
			 * @param {LatLng}            latlng    The geographical position for the marker
			 * @param {String}            label     Tooltip for the marker
			 * @param {MarkerColors}      colorDef  The color definition to use
			 * @param {Boolean}           bVisible  Controls whether the marker is shown or hidden
			 * @param {BaseResult}        sample    Reference to the result for which the marker is created
			 * @param {LocationCandidate} candidate (optional) reference to the subresult/locationCandidate for which the marker is created
			 * @return {Marker}           The created marker
			 */
			createMarker: function(type, latlng, label, colorDef, bVisible, sample, candidate) {

				var view = this;
				var letter = candidate ? candidate.category(this.getThresholdSettings()) : colorDef.smb;
				var icon;

				if (type === OverlayTypes.AXFMARKER) {

					if (this.appsettings.get("useDynamicMarkerColors")) {

						var value = sample.get(this.appsettings.get("markerColorAttribute"));
						label += ": " + value.toString();
						icon = this.getMarkerIcon(IconTypes.DYNAMIC, letter);
						icon.fillColor = this.colorMapper.getColor(value);
					}
					else {
						var cat = sample.category(this.getThresholdSettings());
						icon = this.getMarkerIcon(IconTypes.DOT, cat);
					}
				}
				else {
					if (this.appsettings.get("useDotAccuracyMarkers")) {

						icon = this.getMarkerIcon(IconTypes.DOT, letter);
					}
					else {
						var color = colorDef.bgcolor + "|" + colorDef.color;

						icon = this.getMarkerIcon(IconTypes.PIN, letter + "|" + color);
					}
				}

				var marker = new google.maps.Marker(
					{
						position: latlng,
						map: bVisible ? this.map : null,
						icon: icon,
						title: label,
						zIndex: Z_Index.RESULT
					}
				);

				// store some extra data on the marker
				var md = marker.metaData = {};
				if (sample) {
					md.model = candidate ? candidate
										 : sample;

					if (sample.get('sessionId') !== undefined)
						md.sessionId = sample.get('sessionId');
				}

				// register the marker
				if (type !== undefined) {
					// use the symbol as a category
					this.registerOverlay(type, marker, colorDef.smb);
					md.type = type;
				}

				// click event to the for the marker
				google.maps.event.addListener(marker, 'click',
					function() {
						// in here "this" is bound to the marker
						view.onMarkerClick(this);
					}
				);
				google.maps.event.addListener(marker, 'dblclick',
					function() {
						// in here "this" is bound to the marker
						view.onMarkerDblClick(this);
					}
				);

				return marker;
			},

			/**
			 * Return the Marker icon for the given type. Creates it on first request and caches it.
			 * @param  {IconTypes} type General type of the marker - e.g. dot, pin, site...
			 * @param  {String} option    (optional) parameters for the type (e.g. letters "M/S/I" for AXF dot markers)
			 * @return {MarkerImage}
			 */
			getMarkerIcon: function(type, option) {

				// option is optional
				option = option || "";

				var key = type + "_" + option;

				// already in cache?
				if (IconCache[key] !== undefined) {
					return IconCache[key];
				}

				var imagePath = null;
				var icon;

				// the common size+offsets of our AXF marker images
				var geometry = {
					size: new google.maps.Size(10,10),
					origin: new google.maps.Point(0,0),
					anchor: new google.maps.Point(5,5)
				};

				switch (type) {
					case IconTypes.DOT:
						if (option == "M") {
							imagePath = 'images/circle_red.png';
						}
						else if (option == "IM") {
							imagePath = 'images/circle_red_yellow.png';
							// imagePath = 'images/circle_half_red.png';
						}
						else if (option == "I") {
							imagePath = 'images/circle_yellow.png';
						}
						else if (option == "S") {
							imagePath = 'images/circle_orange.png';
						}
						else if (option == "R") {
							imagePath = 'images/circle_blue.png';
						}
						break;

					case IconTypes.PIN:
						imagePath = "http://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=" + option;
						geometry = {
							size: null,
							origin: null,
							anchor: new google.maps.Point(10, 34)
						};
						break;

					case IconTypes.SITE:
						if (option == "selected") {
							imagePath = 'images/siteSelectedBig.png';
							geometry.size = new google.maps.Size(13,13);
							geometry.anchor = new google.maps.Point(6,6);
						}
						else {
							imagePath = 'images/site.png';
							geometry.size = new google.maps.Size(9,9);
							geometry.anchor = new google.maps.Point(4,4);
						}
						break;

					case IconTypes.DYNAMIC:
						icon = {
							path: google.maps.SymbolPath.CIRCLE,
							fillColor: "#000", // dummy color
							fillOpacity: 1,
							scale: 5,
							strokeColor: "#333",
							strokeOpacity: "0.6",
							strokeWeight: 1,
						};
						// return directly, no MarkerImage is needed.
						return icon;
				}

				icon = new google.maps.MarkerImage(imagePath,
												   geometry.size, geometry.origin, geometry.anchor);

				IconCache[key] = icon;

				return icon;
			},

			/**
			 * Creates a line overlay connecting measured and calculated points.
			 * @param {LatLng} startLatLng The geographical position for the start of the line
			 * @param {LatLng} endLatLng   The geographical position for the end of the line
			 * @param {Boolean} visible    Controls whether the line is shown or hidden
			 */
			drawReferenceLine: function(startLatLng, endLatLng, visible) {

				this.createLine([startLatLng, endLatLng], "#FF5050", 2, 0.3, OverlayTypes.REFERENCELINE, visible);
			},

			/**
			 * Draws polylines connecting all reference locations and best-candidate locations in a session.
			 * @param  {Session} session The session model.
			 */
			drawSessionLines: function(session) {

				if (!session) {
					this.deleteSessionOverlays();
					return;
				}

				// check if the session actually changed
				if (this.highlightedSessionId !== session.id) {

					// remove old lines and markers
					this.deleteSessionOverlays();

					this.highlightedSessionId = session.id;

					// draw new lines
					if (session.results &&
						session.results.length > 1) {

						var refLocations = [],
							bestLocations = [];

						// extract the non-NaN locations
						session.results.each(function(sample) {

							var latLng = GoogleMapsUtils.makeLatLng(sample.get('position'));
							GoogleMapsUtils.pushIfNew(refLocations, latLng);

							if (sample instanceof AccuracyResult) {
								latLng = GoogleMapsUtils.makeLatLng(sample.getBestLocationCandidate().get('position'));
								GoogleMapsUtils.pushIfNew(bestLocations, latLng);
							}
						});

						var sessionLinesEnabled = this.appsettings.get("drawSessionLines");
						this.createLine(refLocations, "#A0B1BC", 6, 0.8, OverlayTypes.SESSIONLINE, sessionLinesEnabled);
						this.createLine(bestLocations, "#B479FF", 6, 0.8, OverlayTypes.SESSIONLINE, sessionLinesEnabled);
					}
				}
			},

			/**
			 * Removes all session highlight overlays from the map.
			 */
			deleteSessionOverlays: function() {

				// remove old lines and markers
				this.deleteOverlaysForType(OverlayTypes.SESSIONLINE);
				this.deleteOverlaysForType(OverlayTypes.CANDIDATEMARKER);

				this.highlightedSessionId = -1;
				this.highlightedCandidateSampleCid = -1;
			},

			/**
			 * Creates a polyline overlay and adds it to the map.
			 * @param {Array}        points  Array of LatLng positions for the polyline
			 * @param {string}       color   A hexadecimal HTML color of the format "#FFFFFF"
			 * @param {int}          weight  Line weight in pixels
			 * @param {number}       opacity The opacity (0..1.0)
			 * @param {OverlayTypes} type    The type of the overlay
			 * @param {Boolean}      visible Controls whether the line is shown or hidden
			 * @return {PolyLine} reference to the created overlay
			 */
			createLine: function(points, color, weight, opacity, type, visible) {

				var options = {
					path: points,
					strokeColor: color,
					strokeOpacity: opacity,
					strokeWeight: weight,
					clickable: false,
					map: visible ? this.map : null
				};

				// apply line symbols for session lines
				if (type === OverlayTypes.SESSIONLINE) {
					options.icons = [{
						icon: {
							path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
							strokeColor: "#000",
							strokeOpacity: "0.6",
							strokeWeight: 1,
							fillOpacity: opacity,
							scale: 4
						},
						offset: '50%',
						repeat: '100px'
					}];
				}
				else if (type === OverlayTypes.SELECTIONVIZ) {
					options.zIndex = Z_Index.HIGHLIGHT;
				}

				var line = new google.maps.Polyline(options);

				this.registerOverlay(type, line);
				return line;
			},

			/**
			 * Creates a marker with a circular shape to highlight selections and adds it to the map.
			 * @return {Marker} reference to the created marker
			 */
			createHighlightCircle: function() {

				var marker = new google.maps.Marker({
					icon: {
						path: google.maps.SymbolPath.CIRCLE,
						fillColor: "#CCCCCC",
						fillOpacity: 0.5,
						scale: 15,
						strokeColor: "#666",
						strokeOpacity: 0.8,
						strokeWeight: 1,
					},
					map: this.map,
					clickable: false,
					zIndex: Z_Index.HIGHLIGHT
				});
				this.registerOverlay(OverlayTypes.SELECTIONVIZ, marker);

				return marker;
			},

			/**
			 * Creates a polyline to highlight the refLine for AccuracyResults.
			 * @return {PolyLine} the reference to the created overlay
			 */
			createHighlightLine: function() {
				return this.createLine([], "#FFC955", 4, 0.9, OverlayTypes.SELECTIONVIZ, false);
			},

			/**
			 * Creates a marker with a custom graphic to highlight sites and adds it to the map.
			 * @return {Marker} reference to the created marker
			 */
			createHighlightForSites: function() {

				var marker = new google.maps.Marker({
					icon: this.getMarkerIcon(IconTypes.SITE, "selected"),
					map: this.map,
					zIndex: Z_Index.SITE + this.networkMarkerZOffset + 10
				});
				this.registerOverlay(OverlayTypes.SELECTIONVIZ, marker);

				return marker;
			},

			/**
			 * Helper method for visual inspection of the bounding box.
			 * @param {LatLngBounds} bounds Coordinates for the rectangle
			 * @param {String}       color  The stroke color as HTML color of the format "#FFFFFF"
			 */
			drawRectangle: function(bounds, color) {

				// draw a green shaded box
				var rect = new google.maps.Rectangle({
					bounds: bounds,
					map: this.map,
					strokeColor: color,
					strokeWeight: 3,
					strokeOpacity: 0.8
				});

				this.registerOverlay(OverlayTypes.DEBUG, rect);
			},

			/**
			 * Handler for clicks on map markers.
			 */
			onSiteClick: function(siteMarker) {

				if (siteMarker && siteMarker.metaData) {

					var md = siteMarker.metaData;
					if (md.model)
						this.trigger("site:selected", md.model);
				}
			},

			/**
			 * Handler for double-clicks on sector markers.
			 */
			onSectorDblClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.model) {

						var sector = md.model;
						var query = new ResultsFilterQuery(
							ResultsFilterQuery.TOPIC_PRIMARYCELL,
							sector.get('id'),
							sector.get('netSegment'),
							sector.get('cellIdentity')
						);
						this.filterResultsBySector(query);
					}
				}
			},

			/**
			 * Handler for clicks on map result markers.
			 */
			onMarkerClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.model)
						this.trigger("result:selected", md.model);

					if (md.sessionId !== undefined &&
						md.sessionId !== 0) {

						var session = this.collection.get(md.sessionId);
						if (session) {

							this.trigger("session:selected", session);
						}
					}
					else {
						this.trigger("session:selected", null);
					}
				}
			},

			/**
			 * Handler for double-clicks on map result markers.
			 */
			onMarkerDblClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;

					if (md.type !== undefined &&
						md.type === OverlayTypes.GEOLOCMARKER &&
						md.model !== undefined) {

						// draw location candidates
						var sample = md.model;
						if (sample && sample instanceof AccuracyResult) {
							this.drawCandidateMarkers(sample);
						}
					}
					else {
						// type unknown or "not geoloc"
						this.deleteCandidateMarkers();
					}
				}
			},

			/**
			 * Toggles result markers between default and colored-by-value modes.
			 */
			updateMarkerColors: function() {

				if (this.appstate.get("heatmapActive"))
					return;

				// remove markers to change
				this.deleteOverlaysForType(OverlayTypes.GEOLOCMARKER);
				this.deleteOverlaysForType(OverlayTypes.REFERENCEMARKER);
				this.deleteOverlaysForType(OverlayTypes.CANDIDATEMARKER);
				this.deleteOverlaysForType(OverlayTypes.AXFMARKER);

				// redraw all the markers
				this.drawSessions();

				// TODO: filter somehow, as performance with dynamic colors gets bad > 1000 results.
/*				// get the currently highlighted session
				var session = this.collection.get(this.highlightedSessionId);

				if (!session)
					return;

				// update markers of the session...
				session.results.each(function(){
					//
					bDynamicColors;
				});
*/
			},

			/**
			 * Focus on a session by zooming to its bounds.
			 * @param {Session} session The session model.
			 */
			focusSession: function(session) {

				if ( this.highlightedSessionId >= 0 &&
					(!session || session.id !== this.highlightedSessionId)) {

					this.deleteSessionOverlays();
				}

				if (!session)
					return;

				// determine the extents of the session
				var sessionRect = new google.maps.LatLngBounds();

				session.results.each(function(sample) {

					var latLng = GoogleMapsUtils.makeLatLng(sample.get('position'));
					if (isValidLatLng(latLng))
						sessionRect.extend(latLng);

					if (sample instanceof AccuracyResult) {
						latLng = GoogleMapsUtils.makeLatLng(sample.getBestLocationCandidate().get('position'));
						if (isValidLatLng(latLng))
							sessionRect.extend(latLng);
					}
				});

				if (!sessionRect.isEmpty())
					this.map.fitBounds(sessionRect);
			},

			// create a circle shape for reuse for all result highlighting needs
			getHighlightForMarkers: function() {
				if (!this.selectedMarkerHighlight) {
					this.selectedMarkerHighlight = this.createHighlightCircle();
				}
				return this.selectedMarkerHighlight;
			},

			getHighlightForReferenceMarkers: function() {
				if (!this.selectedReferenceMarkerHighlight) {
					this.selectedReferenceMarkerHighlight = this.createHighlightCircle();
				}
				return this.selectedReferenceMarkerHighlight;
			},

			getHighlightForReferenceLines: function() {
				if (!this.selectedReferenceLineHighlight) {
					this.selectedReferenceLineHighlight = this.createHighlightLine();
				}
				return this.selectedReferenceLineHighlight;
			},

			/**
			 * Highlight the given result by drawing a overlay around it.
			 * @param {BaseResult} result
			 */
			highlightResult: function(result) {

				if (result !== null &&
					result !== undefined) {

					// draw a highlight around the result
					var highlight = this.getHighlightForMarkers();

					var latLng = GoogleMapsUtils.makeLatLng(result.getGeoPosition()),
						validLoc = isValidLatLng(latLng);

					if (validLoc) {
						// update the position
						highlight.setPosition(latLng);
					}
					this.setMarkerVisible(highlight, validLoc);

					if (result instanceof AccuracyResult) {
						// for AccuracyResults draw a second circle for the reference

						highlight = this.getHighlightForReferenceMarkers();

						var latLngRef = GoogleMapsUtils.makeLatLng(result.getRefPosition()),
							validRefLoc = isValidLatLng(latLngRef);

						if (validRefLoc) {
							highlight.setPosition(latLngRef);
						}
						this.setMarkerVisible(highlight, validRefLoc);

						highlight = this.getHighlightForReferenceLines();
						if (validLoc && validRefLoc)
							highlight.setPath([latLng, latLngRef]);
						this.setMarkerVisible(highlight, validLoc && validRefLoc);
					}
					else {
						this.setMarkerVisible(this.selectedReferenceMarkerHighlight, false);
						this.setMarkerVisible(this.selectedReferenceLineHighlight, false);
					}
				}
				else {
					// hide the highlights
					this.setMarkerVisible(this.selectedMarkerHighlight, false);
					this.setMarkerVisible(this.selectedReferenceMarkerHighlight, false);
					this.setMarkerVisible(this.selectedReferenceLineHighlight, false);
				}
			},

			/**
			 * Highlight the given site by drawing an overlay.
			 * @param {Site}    site          The model of the site
			 * @param {Boolean} ensureVisible Controls if map viewport should be adjusted
			 */
			highlightSite: function(site, ensureVisible) {

				if (site) {

					if (!this.selectedSiteHighlight) {
						// create overlay for reuse for all site highlighting needs
						this.selectedSiteHighlight = this.createHighlightForSites();
					}

					var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));
					var bShow = isValidLatLng(latLng);
					if (bShow) {
						// update the position
						this.selectedSiteHighlight.setPosition(latLng);
					}
					this.setMarkerVisible(this.selectedSiteHighlight, bShow);

					// draw sectors for the site
					this.deleteOverlaysForType(OverlayTypes.SECTOR);
					this.drawSectorsForSite(site);

					if (ensureVisible && bShow) {
						var bounds = this.map.getBounds();
						// check manually, as fitBounds() even zooms out for unchanged bounds
						if (!bounds.contains(latLng)){
							bounds.extend(latLng);
							this.map.fitBounds(bounds);
						}
					}
				}
				else {
					// reset previous highlighted site
					this.setMarkerVisible(this.selectedSiteHighlight, false);
				}
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
