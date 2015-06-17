define(
	["underscore", "backbone",
	 "views/map/baselayer", "views/map/markercolors",
	 "models/session", "models/AccuracyResult", "models/axfresult", "models/site", "models/sector", "models/resultoverlay",
	 "types/position", "types/googlemapsutils", "types/colormapper"],

	function(_, Backbone,
			 BaseLayer, MarkerColors,
			 Session, AccuracyResult, AxfResult, Site, Sector, ResultOverlay,
			 Position, GoogleMapsUtils, ColorMapper) {

		/**
		 * Result Marker Map Layer.
		 * Emits the following events: event name (payload)
		 *   result:selected (BaseResult model)
		 *   session:selected (Session model)
		 *   reset
		 */
		var ResultLayer = BaseLayer.extend({

			constructor: function ResultLayer() {
				BaseLayer.prototype.constructor.apply(this, arguments);
			},

			/** @type {MapView} the parent view */
			mapview: null,

			// reference to the overlay used to highlight result markers
			selectedMarkerHighlight: null,
			selectedReferenceMarkerHighlight: null,
			selectedReferenceLineHighlight: null,

			// id of the currently highlighted session (see drawSessionLines())
			highlightedSessionId: -1,

			// cid of the sample/result for which candidate markers are drawn (see drawCandidateMarkers())
			highlightedCandidateSampleCid: -1,

			// maps result values to colors
			colorMapper: null,

			initialize: function(options) {

				BaseLayer.prototype.initialize.apply(this, [options]);

				this.mapview = options.mapview;

				this.listenTo(this.collection, "reset", this.onSessionsReset);

				// listen for settings changes
				this.listenTo(this.settings, "change:confidenceThreshold", this.confidenceThresholdChanged);
				this.listenTo(this.settings, "change:useDynamicMarkerColors change:mobilityThreshold change:indoorThreshold change:useDotAccuracyMarkers", this.updateMarkerColors);
				this.listenTo(this.settings, "change", this.onSettingsChanged);

				this.listenTo(this.appstate, "change:selectedSession", this.selectedSessionChanged);
				this.listenTo(this.appstate, "change:selectedResult", this.selectedResultChanged);
				this.listenTo(this.appstate, "change:focussedSessionId", this.focussedSessionChanged);
				this.listenTo(this.appstate, "change:resultsEditMode", this.resultsEditModeChanged);
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

				if (event.changed.markerColorAttribute !== undefined) {
					this.markerAttributeChanged(event.changed.markerColorAttribute);
				}
			},

			confidenceThresholdChanged: function() {

				if (this.mapview.shouldZoomToResults())
					this.resetBounds();

				if (this.appstate.get("heatmapActive") === false)
					_.defer(this.updateMarkerColors.bind(this)); // deferred to allow call stack to unwind, e.g. Settings dialog to close.
			},

			/**
			 * Change listener for AppState's "resultsEditMode" property
			 * @param {AppState} appstate
			 */
			resultsEditModeChanged: function(appstate) {

				if (appstate.changed.resultsEditMode !== undefined) {
					_.defer(this.setOverlaysDraggable.bind(this), OverlayTypes.AXFMARKER, appstate.changed.resultsEditMode);
				}
			},

			selectedSessionChanged: function(event) {

				var session = event.changed.selectedSession;
				this.drawSessionLines(session);
			},

			focussedSessionChanged: function(event) {

				var sessionId = event.changed.focussedSessionId;
				if (sessionId < 0) {
					return;
				}

				var session = this.collection.findSession(sessionId);
				this.focusSession(session);
			},

			/**
			 * Handler for the "change:selectedResult" event on AppState.
			 */
			selectedResultChanged: function(appstate) {

				var result = appstate.changed.selectedResult;

				var oldResult = appstate.previous("selectedResult");
				if (oldResult)
					this.stopListening(oldResult);

				if (result !== null) {
					this.listenTo(result, {
						"position-reverted": this.selectedResultReverted,
						"change:position": this.highlightResult
					});
				}

				// this timeout is necessary to make the result marker doubleclick work
				_.defer(this.highlightResult.bind(this, result));
			},

			/**
			 * Handler for the "position-reverted" event on the selected result model.
			 */
			selectedResultReverted: function() {
				// connect results along restored positions
				this.updateSessionLines();
			},

			/**
			 * Draw result markers on Google Map.
			 */
			draw: function() {

				this.deleteResultOverlays();
				this.resetBounds();
				this.drawResultMarkers();
			},

			/**
			 * Redraw result markers for all sessions in the SessionList collection.
			 */
			drawResultMarkers: function() {

				// initialize the color mapper
				if ( this.settings.get("useDynamicMarkerColors") &&
					!this.appstate.has("markerColorMapper")) {

					this.configureColorMapperForAttribute(this.settings.get("markerColorAttribute"));
				}

				// capture the "this" scope
				var view = this;
				this.collection.each(function(session) {
					view.drawSession(session);
				});
			},

			/**
			 * Draw markers for results in the given session matching the current filter
			 * @param  {Session} session The session model.
			 */
			drawSession: function(session) {

				var view = this,
					resultFilterFct = this.mapview.getResultFilterFunction();

				var thresholds = this.settings.getThresholdSettings();

				session.results.each(function(sample) {

					// check if the result sample matches the current filter
					if (resultFilterFct !== null &&
						resultFilterFct(sample) === false)
						return;

					if (sample.get("confidence") < thresholds.confidence)
						return;

					if (sample instanceof AccuracyResult) {

						view.drawAccuracyResult(sample);
					}
					else if (sample instanceof AxfResult) {

						view.drawResult(sample);
					}
				});
			},

			/**
			 * Draw markers and line for accuracy results.
			 * @param  {AccuracyResult} sample
			 */
			drawAccuracyResult: function(sample) {

				var refLinesVisible = this.settings.get("drawReferenceLines"),
					refLoc = GoogleMapsUtils.makeLatLng(sample.getRefPosition());

				// some sample files contain "NaN" coordinates. using them messes up the map and the bounding box.
				if (isValidLatLng(refLoc)) {

					this.bounds.extend(refLoc);

					this.createMarker(OverlayTypes.REFERENCEMARKER,
									  refLoc,
									  "#" + sample.get('msgId'),
									  MarkerColors.REFERENCE,
									  this.settings.get("drawMarkers_R"),
									  sample);
				}

				var bestCand = sample.getBestLocationCandidate();
				var bestLoc = GoogleMapsUtils.makeLatLng(sample.getGeoPosition());

				this.drawResult(bestCand, OverlayTypes.GEOLOCMARKER, sample);

				// connect measured and calculated points with lines
				this.drawReferenceLine(refLoc, bestLoc, refLinesVisible);
			},

			/**
			 * Draw a marker for an (AXF) result.
			 * @param  {BaseResult} sample       the model for the marker
			 * @param  {OverlayTypes} markerType controls the marker shape, if omitted the default is AXFMARKER
			 * @param  {BaseResult} parent       (optional) the model of the parent, e.g. if sample is a LocationCandidate
			 */
			drawResult: function(sample, markerType, parent) {

				markerType = markerType || OverlayTypes.AXFMARKER;
				// for LocationCandidate a parent model should be provided
				var model = parent || sample;

				var color = null, visible = true,
					thresholds = this.settings.getThresholdSettings();

				var location = GoogleMapsUtils.makeLatLng(sample.getGeoPosition());
				switch (sample.category(thresholds)) {
					case "S":
						color = MarkerColors.STATIONARY;
						visible = this.settings.get("drawMarkers_S");
						break;
					case "I":
					case "IM":
						color = MarkerColors.INDOOR;
						visible = this.settings.get("drawMarkers_I");
						break;
					case "M":
						color = MarkerColors.GEOLOCATED;
						visible = this.settings.get("drawMarkers_M");
						break;
				}

				this.createMarker(markerType,
								  location,
								  "#" + sample.get('msgId'),
								  color,
								  visible,
								  model);

				this.bounds.extend(location);
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

					var visible = this.settings.get("drawMarkers_C");
					// start at "1" to skip best candidate
					for (var i = 1; i < sample.locationCandidates.length; i++) {

						var candidate = sample.locationCandidates.at(i);
						var latLng = GoogleMapsUtils.makeLatLng(candidate.getGeoPosition());
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

				this.overlays.removeByType(OverlayTypes.CANDIDATEMARKER);
				this.highlightedCandidateSampleCid = -1;
			},

			/**
			 * Creates a marker and adds it to the map.
			 * @param {OverlayTypes}      type      The type of the marker (one of REFERENCEMARKER, GEOLOCMARKER, AXFMARKER, CANDIDATEMARKER)
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
				var thresholds = this.settings.getThresholdSettings();
				var letter = candidate ? candidate.category(thresholds) : colorDef.smb;
				var icon,
					draggable = false;

				if (type === OverlayTypes.AXFMARKER) {

					draggable = this.appstate.get("resultsEditMode");
					if (this.settings.get("useDynamicMarkerColors")) {

						var value = sample.get(this.settings.get("markerColorAttribute"));
						label += ": " + value.toString();
						icon = this.getMarkerIcon(IconTypes.DYNAMIC, letter);
						icon.fillColor = this.colorMapper.getColor(value);
					}
					else {
						var cat = sample.category(thresholds);
						icon = this.getMarkerIcon(IconTypes.DOT, cat);
					}
				}
				else {
					if (this.settings.get("useDotAccuracyMarkers")) {

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
						draggable: draggable,
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
					this.overlays.add(new ResultOverlay({
						type: type,
						category: colorDef.smb,
						ref: marker,
						result: md.model,
					}));
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
				google.maps.event.addListener(marker, 'dragend',
					function() {
						view.onMarkerDragEnd(this);
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

					case IconTypes.DYNAMIC:
						icon = {
							path: google.maps.SymbolPath.CIRCLE,
							fillColor: "#000", // dummy color
							fillOpacity: 1,
							scale: 5,
							strokeColor: "#333",
							strokeOpacity: 0.6,
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

							var latLng = GoogleMapsUtils.makeLatLng(sample.getGeoPosition());
							GoogleMapsUtils.pushIfNew(bestLocations, latLng);

							if (sample instanceof AccuracyResult) {
								latLng = GoogleMapsUtils.makeLatLng(sample.getRefPosition());
								GoogleMapsUtils.pushIfNew(refLocations, latLng);
							}
						});

						var sessionLinesEnabled = this.settings.get("drawSessionLines");
						this.createLine(bestLocations, "hsl(204, 17%, 68%)", 6, 0.8, OverlayTypes.SESSIONLINE, sessionLinesEnabled); // grey hsl(204, 17%, 68%)
						this.createLine(refLocations, "hsl(245, 50%, 74%)", 6, 0.8, OverlayTypes.SESSIONLINE, sessionLinesEnabled); // violet hsl(266, 100%, 74%)
					}
				}
			},

			/**
			 * Redraw the session lines, e.g. after positions changed.
			 */
			updateSessionLines: function() {
				var selectedSession = this.appstate.get('selectedSession');
				// force a redraw, even if "selectedSession.id == highlightedSessionId"
				this.highlightedSessionId = -1;
				this.drawSessionLines(selectedSession);
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
							strokeOpacity: 0.6,
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

				this.overlays.register(type, line);
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
				this.overlays.register(OverlayTypes.SELECTIONVIZ, marker);

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
			 * Handler for clicks on map result markers.
			 */
			onMarkerClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.model)
						this.trigger("result:selected", md.model);

					if (md.sessionId !== undefined &&
						md.sessionId !== Session.ID_DUMMY) {

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
			 * Handler for drag end on map result markers.
			 */
			onMarkerDragEnd: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;

					if (md.type !== undefined &&
						md.type === OverlayTypes.AXFMARKER &&
						md.model !== undefined) {

						// update position in AxfResult
						var sample = md.model;
						if (sample && sample instanceof AxfResult) {
							var pos = GoogleMapsUtils.makePosition(marker.position);
							sample.updateGeoPosition(pos);
							this.appstate.set("resultsEdited", true);

							this.updateSessionLines();
						}
					}
				}
			},

			/**
			 * Redraws result markers after settings changes.
			 * E.g. toggles result markers between default and colored-by-value modes.
			 */
			updateMarkerColors: function() {

				if (this.appstate.get("heatmapActive"))
					return;

				this.appstate.set("busy", true);

				// remove markers to change
				this.overlays.removeByType(OverlayTypes.GEOLOCMARKER);
				this.overlays.removeByType(OverlayTypes.REFERENCEMARKER);
				this.overlays.removeByType(OverlayTypes.CANDIDATEMARKER);
				this.overlays.removeByType(OverlayTypes.AXFMARKER);

				// redraw all the markers
				this.drawResultMarkers();

				this.appstate.set("busy", false);

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

					var latLng = GoogleMapsUtils.makeLatLng(sample.getGeoPosition());
					if (isValidLatLng(latLng))
						sessionRect.extend(latLng);

					if (sample instanceof AccuracyResult) {
						latLng = GoogleMapsUtils.makeLatLng(sample.getRefPosition());
						if (isValidLatLng(latLng))
							sessionRect.extend(latLng);
					}
				});

				if (!sessionRect.isEmpty())
					this.map.fitBounds(sessionRect);
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

				this.trigger("reset");
			},

			/**
			 * Removes all session highlight overlays from the map.
			 */
			deleteSessionOverlays: function() {

				// remove old lines and markers
				this.overlays.removeByType(OverlayTypes.SESSIONLINE);
				this.overlays.removeByType(OverlayTypes.CANDIDATEMARKER);

				this.highlightedSessionId = -1;
				this.highlightedCandidateSampleCid = -1;
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
			 * Toggle the "draggable" property of AXF result markers
			 * @param {OverlayTypes} type
			 * @param {Boolean}      bDraggable True to drag
			 */
			setOverlaysDraggable: function(type, bDraggable) {

				var overlays = this.overlays.byType(type);

				_.each(
					overlays,
					function(overlay) {
						var marker = overlay.get('ref');
						marker.setDraggable(bDraggable);
					}
				);
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
			 * Update the visibility of all overlays registered under the given type.
			 * @param {OverlayTypes} type  Overlay type
			 * @param {Boolean}      bShow True to show, false to hide
			 */
			showOverlaysForType: function(type, bShow) {

				var overlays = this.overlays.byType(type);
				this.setOverlaysVisible(overlays, bShow);
			},



			/**
			 * Listener for "reset" on sessions collection. Removes all result markers.
			 */
			onSessionsReset: function() {

				this.deleteResultOverlays();
			},

			markerAttributeChanged: function(attributeName) {

				this.configureColorMapperForAttribute(attributeName);
				// redraw markers
				if (this.settings.get("useDynamicMarkerColors"))
					this.updateMarkerColors();
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

		});

		var IconTypes = Object.freeze({
			PIN: "pin",
			DOT: "dot",
			DYNAMIC: "dynamic",
		});

		var OverlayTypes = Object.freeze({
			REFERENCEMARKER: "refMarker",
			GEOLOCMARKER: "geoMarker",
			AXFMARKER: "axfMarker",
			CANDIDATEMARKER: "candidateMarker",
			REFERENCELINE: "refLine",
			SESSIONLINE: "sessionLine",
			SELECTIONVIZ: "selectionViz",
		});

		var Z_Index = Object.freeze({
			HIGHLIGHT: -10, // TS: only negative values really put the highlight under the result markers
			RESULT: 100,
		});

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

		return ResultLayer;
	}
);
