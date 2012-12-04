define(
	["underscore", "backbone",
	 "collections/overlays",
	 "models/AccuracyResult", "models/axfresult"],
	function(_, Backbone, OverlayList, AccuracyResult, AxfResult) {

		// marker types 'n colors
		var MarkerColors = Object.freeze({
			REFERENCE:	{ bgcolor: "0000FF", color: "FFFFFF", smb: "R", label: "Reference Marker" }, // blue
			GEOLOCATED: { bgcolor: "FF0000", color: "FFFFFF", smb: "M", label: "Mobile" }, // red
			STATIONARY: { bgcolor: "FF9900", color: "000000", smb: "S", label: "Stationary" }, // orange
			INDOOR:		{ bgcolor: "FBEC5D", color: "000000", smb: "I", label: "Indoor" }, // yellow
			CANDIDATE:	{ bgcolor: "CCFFFF", color: "000000", smb: "C", label: "Location Candidate" }, // skyblue
			/*ACTIX:		{ bgcolor: "006983", color: "CCCCCC", smb: "A", label: "Home" },*/
		});

		var OverlayTypes = Object.freeze({
			SITE: "siteSymbol",
			SECTOR: "sectorSymbol",
			REFERENCEMARKER: "refMarker",
			GEOLOCMARKER: "geoMarker",
			AXFMARKER: "axfMarker",
			CANDIDATEMARKER: "candidateMarker",
			REFERENCELINE: "refLine",
			SESSIONVIZ: "sessionViz",
			SELECTIONVIZ: "selectionViz",
			DEBUG: "debug"
		});

		var Z_Index = Object.freeze({
			HIGHLIGHT: -10, // TS: only negative values really put the highlight under the result markers
			RESULT: 1,
			SITE: 100
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

		// "map" of already created MarkerImages by type
		var MarkerImages = {};

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

			map: null,

			// bounding rectangle around all reference and geolocated markers
			bounds: null,

			/** @type {OverlayList} collection of all map objects */
			overlays: null,

			/** @type {SiteList} collection of sites */
			siteList: null,

			// reference to the overlay used to highlight result markers
			selectedMarkerHighlight: null,
			selectedMarkerHighlightBestLoc: null,

			/** @type {Marker} reference to overlay used to highlight the selected site */
			selectedSiteHighlight: null,

			// id of the currently highlighted session (see drawSessionLines())
			highlightedSessionId: -1,

			// cid of the sample/result for which candidate markers are drawn (see drawCandidateMarkers())
			highlightedCandidateSampleCid: -1,

			// returns the colors dictionary
			colors: function() { return MarkerColors; },

			initialize: function() {

				var mapCenter = new google.maps.LatLng(51.049035, 13.73744); // Actix Dresden Location

				// include the custom MapTypeId to add to the map type control.
				var mapOptions = {
					zoom: 16,
					center: mapCenter,
					disableDefaultUI: true,
					zoomControl: true,
					mapTypeControl: true,
					//scaleControl: true,
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

				// (from https://developers.google.com/maps/documentation/javascript/styling)
				// Create a new StyledMapType object, passing it the array of styles,
				// as well as the name to be displayed on the map type control.
				var styledMapType = new google.maps.StyledMapType(simpleMapStyles, {name: "Map"});

				// Force the height of the map to fit the window
				//this.$el.height($(window).height() - $("header").height());

				// setup Google Maps component
				this.map = new google.maps.Map(this.el, mapOptions);

				this.resetBounds();

				//Associate the styled map with the MapTypeId and set it to display.
				this.map.mapTypes.set(STYLED_MAPTYPE_ID, styledMapType);

				// TODO: 20121017 change to not delete network!
				this.collection.on("reset", this.deleteAllOverlays, this);

				// a collection to keep our overlays in sight
				this.overlays = new OverlayList();

				this.siteList = this.options.siteList;
				this.siteList.on("reset", this.deleteNetworkOverlays, this);

				// listen for settings changes
				this.appsettings = this.options.settings;
				this.appsettings.on("change", this.onSettingsChanged, this);

				// pull legend into the map, add it to map controls
				var legend = $("#mapLegend");
				if (legend && legend.length > 0)
					this.map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(legend[0]);
				var filterbar = $("#filterBar");
				if (filterbar && filterbar.length > 0)
					this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(filterbar[0]);

				// make available for console scripting
//				window.mapview = this;
			},

			/**
			 * Resets the view bounds rectangle
			 */
			resetBounds: function() {
				this.bounds = new google.maps.LatLngBounds();
			},

			/**
			 * Adjusts the viewport center and zoom to fit the currently collected bounds rectangle.
			 */
			zoomToBounds: function() {

				if (!this.bounds.isEmpty())
					this.map.fitBounds(this.bounds);
			},





			/**
			 * Overlay handling
			 */

			/**
			 * Update the visibility of the given marker.
			 * @param {Marker}  marker Google Maps Marker or Polyline object
			 * @param {Boolean} bShow
			 */
			setMarkerVisible: function(marker, bShow) {
				if (marker)
					marker.setMap(bShow ? this.map : null);
			},

			/**
			 * Update the visibility of all overlays in the given array.
			 * @param {Array}   overlays list of Overlay models
			 * @param {Boolean} bShow
			 */
			setOverlaysVisible: function(overlays, bShow) {

				// make ref to capture in inner function
				var view = this;

				_.each(
					overlays,
					function(overlay) {
						var marker = overlay.get('ref');
						view.setMarkerVisible(marker, bShow);
					}
				);
			},

			/**
			 * Update the visibility of all overlays that match the custom filter criterium.
			 * @param {Function} filterFct the callback function for _.filter()
			 * @param {Boolean}  bShow     true to show, false to hide
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
			 * @param {OverlayTypes} type overlay type
			 * @param {Boolean} bShow     true to show, false to hide
			 */
			showOverlaysForType: function(type, bShow) {

				var overlays = this.overlays.byType(type);
				this.setOverlaysVisible(overlays, bShow);
			},

			/**
			 * Update visibility of results markers with the given MarkerColor
			 * @param {MarkerColors} colorDef defines the category
			 * @param {Boolean} bShow         true to show, false to hide
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
			 * @param  {Object} sectorProps List of key-value pairs that should match
			 * @return {void}
			 */
			filterResultsBySector: function(sectorProps) {

				// unselect session and results
				this.trigger("result:selected", null);
				this.trigger("session:selected", null);

				this.trigger("results:filtered");

				// hide all result markers
				this.showResultMarkers(false);

				// list of result markers
				var resultMarkers = this.overlays.filter(this.isResultMarker);

				// filter for sector
				var sectorResults = _.filter(
					resultMarkers,
					function(overlay) {
						var rv = false;

						var marker = overlay.get('ref');
						var md = marker.metaData;

						if (md && md.model) {
							var result = md.model;
							rv = result.get('controllerId') === sectorProps.netSegment &&
								 result.get('primaryCellId') === sectorProps.cellIdentity;
						}

						return rv;
					}
				);
				this.setOverlaysVisible(sectorResults, true);
			},

			clearAllResultFilters: function() {

				// TODO: don't turn on everything, but obey visibility settings!
				this.showResultMarkers(true);
			},

			/**
			 * Hides all overlays for results markers.
			 * @param {Boolean} bShow True to show, false to hide
			 */
			showResultMarkers: function(bShow) {

				if (!bShow) {
					this.deleteCandidateMarkers();
					this.deleteSessionOverlays();
				}

				this.showOverlaysForFilter(this.isResultMarker, bShow);
			},

			/**
			 * Removes all overlays from the map and destroys them.
			 */
			deleteAllOverlays: function() {

				this.overlays.removeAll();
				this.resetBounds();

				this.highlightedSessionId = -1;
				this.highlightedCandidateSampleCid = -1;

				this.selectedSiteHighlight = null;
				this.selectedMarkerHighlight = null;
				this.selectedMarkerHighlightBestLoc = null;
			},

			/**
			 * Removes all site/sector overlays from the map.
			 * @return {void}
			 */
			deleteNetworkOverlays: function() {

				this.selectedSiteHighlight = null;
				this.deleteOverlaysForType(OverlayTypes.SITE);
				this.deleteOverlaysForType(OverlayTypes.SECTOR);
			},

			/**
			 * Removes all overlays with the given type from the map and destroys them.
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

			/**
			 * Store a reference to the maps overlay object by type.
			 * @param {OverlayTypes} type The type of the overlay
			 * @param {Overlay} overlay   The GoogleMaps overlay object. One of {Marker/Line/Polyline}
			 * @param {String} category   (optional) for results we can store the category for filtering.
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
			 * @return {Boolean}         true if this is a result marker overlay
			 */
			isResultMarker: function(overlay) {

				var type = overlay.get('type');
				return (type === OverlayTypes.GEOLOCMARKER ||
						type === OverlayTypes.AXFMARKER ||
						type === OverlayTypes.REFERENCEMARKER);
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
					this.showOverlaysForType(OverlayTypes.SESSIONVIZ, event.changed.drawSessionLines);
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
			},





			/**
			 * Drawing stuff
			 */

			// Draw the radio network consisting of sites and sectors
			drawNetwork: function() {

				// only zoom to the whole network if we don't have results displayed
				var bZoomToNetwork = this.collection.length === 0;

				// capture the "this" scope
				var view = this;
				this.siteList.each(function(site) {
					view.drawSite(site, bZoomToNetwork);
				});

				if (bZoomToNetwork)
					this.zoomToBounds();
			},

			/**
			 * Creates a marker for a site and adds it to the map.
			 * @param  {Site}    site           model for the site
			 * @param  {Boolean} bZoomToNetwork controls whether the current bounds should be updated
			 * @return {void}
			 */
			drawSite: function(site, bZoomToNetwork) {

				var view = this;
				var latLng = site.get('latLng');

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
						icon: this.getMarkerImage("site"),
						position: latLng,
						map: this.map,
						title: makeTooltip(site),
						zIndex: Z_Index.SITE
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
			 * @return {void}
			 */
			drawSectorsForSite: function(site) {

				if (site &&
					site.getSectors().length > 0) {

					var latLng = site.get('latLng');
					if (isValidLatLng(latLng)) {

						var sectorColl = site.getSectors();

						for (var i = 0; i < sectorColl.length; i++) {

							var sector = sectorColl.at(i);
							this.drawSector(sector, latLng);
						}
					}
				}
			},

			drawSector: function(sector, siteLatLng) {

				var view = this;

				// this was necessary to make the symbols actually rotate
				var azi = 1.0 * sector.get('azimuth');
				var marker = new google.maps.Marker({

					icon: {
						path: "M0,0 l0,-6 -1,0 1,-4 1,4 -1,0",
						rotation: azi,
						fillColor: "#6AF",
						fillOpacity: 1,
						scale: 2,
						strokeColor: "#333",
						strokeOpacity: "0.6",
						strokeWeight: 2,
					},
					position: siteLatLng,
					map: this.map,
					title: sector.getTooltipText()
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

			// draw all markers for all sessions
			drawResultMarkers: function() {

				this.resetBounds();
				// capture the "this" scope
				var view = this;
				this.collection.each(function(session) {
					view.drawSession(session);
				});

				this.zoomToBounds();

				// debug code
				//this.drawRectangle(this.bounds, "#00FF00");
			},

			/**
			 * Draw reference and geolocated markers for the given session
			 * @param  {Session} session The session model.
			 * @return {void}
			 */
			drawSession: function(session) {

				var view = this;

				session.results.each(function(sample) {

					var color = null;
					if (sample instanceof AccuracyResult) {
						var refLoc = sample.get('latLng');

						// some sample files contain "NaN" coordinates. using them messes up the map and the bounding box.
						if (isValidLatLng(refLoc)) {

							view.bounds.extend(refLoc);

							view.createMarker(OverlayTypes.REFERENCEMARKER,
											  refLoc,
											  "#" + sample.get('msgId'),
											  MarkerColors.REFERENCE,
											  sample);
						}

						var bestCand = sample.getBestLocationCandidate();
						var bestLoc = bestCand.get('latLng');
						color = (bestCand.category() == "S") ? MarkerColors.STATIONARY
							  : (bestCand.category() == "I") ? MarkerColors.INDOOR
							  : MarkerColors.GEOLOCATED;

						view.createMarker(OverlayTypes.GEOLOCMARKER,
										  bestLoc,
										  "#" + sample.get('msgId'),
										  color,
										  sample);

						view.bounds.extend(bestLoc);

						// connect measured and calculated points with lines
						view.drawReferenceLine(refLoc, bestLoc);
					}
					else if (sample instanceof AxfResult) {

						var location = sample.get('latLng');
						color = (sample.category() == "S") ? MarkerColors.STATIONARY
							  : (sample.category() == "I") ? MarkerColors.INDOOR
							  : MarkerColors.GEOLOCATED;

						view.createMarker(OverlayTypes.AXFMARKER,
										  location,
										  "#" + sample.get('msgId'),
										  color,
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

					// start at "1" to skip best candidate
					for (var i = 1; i < sample.locationCandidates.length; i++) {

						var candidate = sample.locationCandidates.at(i);
						this.createMarker(OverlayTypes.CANDIDATEMARKER,
										  candidate.get('latLng'),
										  "#" + sample.get('msgId'),
										  MarkerColors.CANDIDATE,
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
			 * Creates a marker pin and adds it to the map.
			 * @param {OverlayTypes} type: the type of the marker
			 * @param {LatLng} latlng: the geographical position for the marker
			 * @param {String} label: tooltip for the marker
			 * @param {MarkerColors} colorDef: the color definition to use
			 * @param {BaseResult} sample: reference to the result for which the marker is created
			 * @param {LocationCandidate} candidate: (optional) reference to the subresult/locationCandidate for which the marker is created
			 */
			createMarker: function(type, latlng, label, colorDef, sample, candidate) {

				var view = this;
				var letter = candidate ? candidate.category() : colorDef.smb;
				var icon;

				if (type === OverlayTypes.AXFMARKER) {

					icon = this.getMarkerImage(letter);
/*					icon = {
						path: google.maps.SymbolPath.CIRCLE,
						fillColor: "#" + colorDef.bgcolor,
						fillOpacity: 1,
						scale: 5,
						strokeColor: "#333",
						strokeOpacity: "0.6",
						strokeWeight: 1,
					};
*/				}
				else {
					var color = colorDef.bgcolor + "|" + colorDef.color;

					var iconUrl = "http://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=" + letter + "|" + color;
					icon = new google.maps.MarkerImage(iconUrl, null, null, new google.maps.Point(10, 34));
				}

				var marker = new google.maps.Marker(
					{
						position: latlng,
						map: this.map,
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

			getMarkerImage: function(code) {

				if (MarkerImages[code] === undefined) {

					var imagePath = null;
					var geometry = {
						size: new google.maps.Size(10,10),
						origin: new google.maps.Point(0,0),
						anchor: new google.maps.Point(5,5)
					};
					if (code == "M") {
						imagePath = 'images/circle_red.png';
					}
					else if (code == "I") {
						imagePath = 'images/circle_yellow.png';
					}
					else if (code == "S") {
						imagePath = 'images/circle_orange.png';
					}
					else if (code == "site") {
						imagePath = 'images/site.png';
						geometry.size = new google.maps.Size(9,9);
						geometry.anchor = new google.maps.Point(4,4);
					}
					else if (code == "siteSelected") {
						imagePath = 'images/siteSelectedBig.png';
						geometry.size = new google.maps.Size(13,13);
						geometry.anchor = new google.maps.Point(6,6);
					}

					MarkerImages[code] = new google.maps.MarkerImage(imagePath,
																	 geometry.size, geometry.origin, geometry.anchor);
				}
				return MarkerImages[code];
			},

			/**
			 * Creates a line overlay connecting measured and calculated points.
			 * @param {LatLng} startLatLng: the geographical position for the start of the line
			 * @param {LatLng} endLatLng: the geographical position for the end of the line
			 */
			drawReferenceLine: function(startLatLng, endLatLng) {

				if (this.appsettings.get("drawReferenceLines"))
					this.createLine([startLatLng, endLatLng], "#FF0000", 2, 0.3, OverlayTypes.REFERENCELINE);
			},

			/**
			 * Draws polylines connecting all reference locations and best-candidate locations in a session.
			 * @param  {Session} session The session model.
			 * @return {void}
			 */
			drawSessionLines: function(session) {

				if (!session)
					return;

				// check if the session actually changed
				if (this.highlightedSessionId !== session.id) {

					// remove old lines and markers
					this.deleteSessionOverlays();

					this.highlightedSessionId = session.id;

					// draw new lines
					if (this.appsettings.get("drawSessionLines") &&
						session.results &&
						session.results.length > 1) {

						var refLocations = [],
							bestLocations = [];

						// extract the non-NaN locations
						session.results.each(function(sample) {

							var latLng = sample.get('latLng');
							if (isValidLatLng(latLng))
								refLocations.push(latLng);

							if (sample instanceof AccuracyResult) {
								latLng = sample.getBestLocationCandidate().get('latLng');
								if (isValidLatLng(latLng))
									bestLocations.push(latLng);
							}
						});

						this.createLine(refLocations, "#4AB0F5", 6, 0.8, OverlayTypes.SESSIONVIZ);
						this.createLine(bestLocations, "#B479FF", 6, 0.8, OverlayTypes.SESSIONVIZ);
					}
				}
			},

			/**
			 * Removes all session highlight overlays from the map.
			 * @return {void}
			 */
			deleteSessionOverlays: function() {

				// remove old lines and markers
				this.deleteOverlaysForType(OverlayTypes.SESSIONVIZ);
				this.deleteOverlaysForType(OverlayTypes.CANDIDATEMARKER);

				this.highlightedSessionId = -1;
			},

			/**
			 * Creates a polyline overlay and adds it to the map.
			 * @param {Array} points: array of LatLng positions for the polyline
			 * @param {string} color: a hexadecimal HTML color of the format "#FFFFFF"
			 * @param {int} weight: line weight in pixels
			 * @param {number} opacity: opacity
			 * @param {OverlayTypes} type: the type of the overlay
			 */
			createLine: function(points, color, weight, opacity, type) {

				if (points && points.length > 1) {

					var options = {
						path: points,
						strokeColor: color,
						strokeOpacity: opacity,
						strokeWeight: weight,
						map: this.map
					};

					// apply line symbols for session lines
					if (type === OverlayTypes.SESSIONVIZ) {
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

					var line = new google.maps.Polyline(options);

					this.registerOverlay(type, line);
				}
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
					zIndex: Z_Index.HIGHLIGHT
				});
				this.registerOverlay(OverlayTypes.SELECTIONVIZ, marker);

				return marker;
			},

			/**
			 * Creates a marker with a custom graphic to highlight sites and adds it to the map.
			 * @return {Marker} reference to the created marker
			 */
			createHighlightForSites: function() {

				var marker = new google.maps.Marker({
					icon: this.getMarkerImage("siteSelected"),
					map: this.map,
					zIndex: Z_Index.SITE + 10
				});
				this.registerOverlay(OverlayTypes.SELECTIONVIZ, marker);

				return marker;
			},

			/**
			 * Helper method for visual inspection of the bounding box.
			 * @param {LatLngBounds} bounds
			 * @param {String} color The stroke color as HTML color of the format "#FFFFFF"
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
						var ci = {
							netSegment: sector.get('netSegment'),
							cellIdentity: sector.get('cellIdentity'),
						};
						this.filterResultsBySector(ci);
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
						md.sessionId > 0) {

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

					var latLng = sample.get('latLng');
					if (isValidLatLng(latLng))
						sessionRect.extend(latLng);

					if (sample instanceof AccuracyResult) {
						latLng = sample.getBestLocationCandidate().get('latLng');
						if (isValidLatLng(latLng))
							sessionRect.extend(latLng);
					}
				});

				if (!sessionRect.isEmpty())
					this.map.fitBounds(sessionRect);
			},

			/**
			 * Highlight the given result by drawing a overlay around it.
			 * @param {BaseResult} result
			 */
			highlightResult: function(result) {

				if (result !== null &&
				    result !== undefined) {

					var latLng = result.get('latLng');
					// draw a highlight around the result

					if (!this.selectedMarkerHighlight) {
						// create a circle shape for reuse for all result highlighting needs
						this.selectedMarkerHighlight = this.createHighlightCircle();
					}

					// some AccuracyResults have an invalid reference location
					var bShow = isValidLatLng(latLng);
					if (bShow) {
						// update the position
						this.selectedMarkerHighlight.setPosition(latLng);
					}
					this.setMarkerVisible(this.selectedMarkerHighlight, bShow);

					if (result instanceof AccuracyResult) {
						// for AccuracyResults draw a second circle for the best candidate

						if (!this.selectedMarkerHighlightBestLoc) {
							this.selectedMarkerHighlightBestLoc = this.createHighlightCircle();
						}

						latLng = result.getBestLocationCandidate().get('latLng');
						bShow = isValidLatLng(latLng);
						if (bShow) {
							this.selectedMarkerHighlightBestLoc.setPosition(latLng);
						}

						this.setMarkerVisible(this.selectedMarkerHighlightBestLoc, bShow);
					}
					else {
						this.setMarkerVisible(this.selectedMarkerHighlightBestLoc, false);
					}
				}
				else {
					// hide the highlights
					this.setMarkerVisible(this.selectedMarkerHighlight, false);
					this.setMarkerVisible(this.selectedMarkerHighlightBestLoc, false);
				}
			},

			/**
			 * Highlight the given site by drawing an overlay.
			 * @param {Site}    site
			 * @param {Boolean} ensureVisible Flag to control if map viewport should be adjusted
			 */
			highlightSite: function(site, ensureVisible) {

				if (site) {

					if (!this.selectedSiteHighlight) {
						// create overlay for reuse for all site highlighting needs
						this.selectedSiteHighlight = this.createHighlightForSites();
					}

					var latLng = site.get('latLng');
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
			}
		});

		return MapView;
	}
);
