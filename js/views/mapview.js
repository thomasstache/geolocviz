define(
	["underscore", "backbone",
	 "collections/overlays",
	 "models/AccuracyResult", "models/axfresult"],
	function(_, Backbone, OverlayList, AccuracyResult, AxfResult) {

		// marker types 'n colors
		var MarkerColors = Object.freeze({
			REFERENCE:	{ bgcolor: "0000FF", color: "FFFFFF", smb: "R", category: "Reference Marker" }, // blue
			GEOLOCATED: { bgcolor: "FF0000", color: "FFFFFF", smb: "M", category: "Geolocated" }, // red
			INDOOR:		{ bgcolor: "FBEC5D", color: "000000", smb: "I", category: "Indoor" }, // yellow
			STATIONARY: { bgcolor: "FF9900", color: "000000", smb: "S", category: "Stationary" }, // orange
			CANDIDATE:	{ bgcolor: "CCFFFF", color: "000000", smb: "C", category: "Location Candidate" }, // skyblue
			ACTIX:		{ bgcolor: "006983", color: "CCCCCC", smb: "A", category: "Home" },
		});

		var OverlayTypes = Object.freeze({
			REFERENCEMARKER: "refMarker",
			GEOLOCMARKER: "geoMarker",
			CANDIDATEMARKER: "candidateMarker",
			REFERENCELINE: "refLine",
			SESSIONVIZ: "sessionViz",
			SELECTIONVIZ: "selectionViz",
			DEBUG: "debug"
		});

		var MapView = Backbone.View.extend({

			el: $("#mapContainer"),

			// bounding rectangle around all reference and geolocated markers
			bounds: null,

			// collection of all map objects
			overlays: null,

			// id of the currently highlighted session (see drawSessionLines())
			highlightedSessionId: -1,

			// id of the currently highlighted sample/result (see drawCandidateMarkers())
			highlightedSampleCid: -1,

			// returns the colors dictionary
			colors: function() { return MarkerColors; },

			initialize: function() {

				var mapCenter = new google.maps.LatLng(51.049035, 13.73744); // Actix Dresden Location

				var mapOptions = {
					zoom: 16,
					center: mapCenter,
					scaleControl: true,
					mapTypeId: google.maps.MapTypeId.ROADMAP
				};

				// Force the height of the map to fit the window
				//this.$el.height($(window).height() - $("header").height());

				// setup Google Maps component
				this.map = new google.maps.Map(this.el, mapOptions);

				this.collection.on("add", this.drawMarkers, this);
				this.collection.on("reset", this.deleteAllOverlays, this);

				// a collection to keep our overlays in sight
				this.overlays = new OverlayList();

				// listen for settings changes
				this.appsettings = this.options.settings;
				this.appsettings.on("change", this.updateOverlays, this);

				this.render();
			},

			zoomToBounds: function() {

				if (!this.bounds.isEmpty())
					this.map.fitBounds(this.bounds);
			},





			/**
			 * Overlay handling
			 */

			/**
			 * Removes all overlays from the map and destroys them.
			 */
			deleteAllOverlays: function() {

				this.overlays.removeAll();

				this.highlightedSessionId = -1;
				this.highlightedSampleCid = -1;
			},

			/**
			 * Removes all overlays with the given type from the map and destroys them.
			 */
			deleteOverlaysForType: function(type) {

				var items = this.overlays.byType(type);
				_.each(items, function(overlay) { overlay.removeFromMap(); });
				this.overlays.remove(items);
			},

			/**
			 * Store a reference to the maps overlay object by type.
			 */
			registerOverlay: function(type, overlay) {
				this.overlays.add({
					type: type,
					ref: overlay
				});
			},

			/**
			 * Update map overlay visibility according to current settings.
			 */
			updateOverlays: function() {

				var connectReference = this.appsettings.get("drawReferenceLines");
				var connectSession = this.appsettings.get("drawSessionLines");

				// make ref to capture in inner function
				var map = this.map;

				// show or hide reference lines
				var lineOverlays = this.overlays.byType(OverlayTypes.REFERENCELINE);
				_.each(
					lineOverlays,
					function(overlay) {
						var marker = overlay.get("ref");
						if (marker)
							marker.setMap(connectReference ? map : null);
					}
				);

				// show or hide session lines
				var sessionOverlays = this.overlays.byType(OverlayTypes.SESSIONVIZ);
				_.each(
					sessionOverlays,
					function(overlay) {
						var marker = overlay.get("ref");
						if (marker)
							marker.setMap(connectSession ? map : null);
					}
				);
			},





			/**
			 * Drawing stuff
			 */

			// draw all markers for all sessions
			drawMarkers: function() {

				this.bounds = new google.maps.LatLngBounds();
				// capture the "this" scope
				var view = this;
				this.collection.each(function(session) {
					view.drawSession(session);
				});

				this.zoomToBounds();

				// debug code
				//this.drawRectangle(this.bounds, "#00FF00");
			},

			// draw reference and geolocated markers for the given session
			drawSession: function(session) {

				var view = this;

				session.results.each(function(sample) {

					var color = null;
					if (sample instanceof AccuracyResult) {
						var refLoc = sample.get('latLng');

						// some sample files contain "NaN" coordinates. using them messes up the map and the bounding box.
						if (!isNaN(refLoc.lat()) && !isNaN(refLoc.lng())) {

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

						view.createMarker(OverlayTypes.GEOLOCMARKER,
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

				if (this.highlightedSampleCid != sample.cid) {

					// remove old markers
					this.deleteCandidateMarkers();

					this.highlightedSampleCid = sample.cid;

					// start at "1" to skip best candidate
					for (var i = 1; i < sample.locationCandidates.length; i++) {

						var candidate = sample.locationCandidates.at(i);
						this.createMarker(OverlayTypes.CANDIDATEMARKER,
										  candidate.get('latLng'),
										  "#" + sample.get('msgId'),
										  MarkerColors.CANDIDATE,
										  sample,
										  candidate.category());
					}
				}
			},

			deleteCandidateMarkers: function() {

				this.deleteOverlaysForType(OverlayTypes.CANDIDATEMARKER);
				this.highlightedSampleCid = -1;
			},

			/**
			 * Creates a marker pin and adds it to the map.
			 * @param {LatLng} latlng: the geographical position for the marker
			 * @param {AccuracyResult} sample: reference to the AccuracyResult for which the marker is created
			 * @param {String} label: tooltip for the marker
			 * @param {MarkerColors} colorDef: the color definition to use
			 * @param {OverlayTypes} type: the type of the marker
			 * @param {char} symbol: (optional) the letter for the marker, override the one in colorDef
			 */
			createMarker: function(type, latlng, label, colorDef, sample, symbol) {

				var view = this;
				var color = colorDef.bgcolor + "|" + colorDef.color,
					letter = symbol ? symbol : colorDef.smb;

				var iconUrl = "http://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=" + letter + "|" + color;
				var marker = new google.maps.Marker(
					{
						position: latlng,
						map: this.map,
						icon: new google.maps.MarkerImage(iconUrl, null, null, new google.maps.Point(8, 34)),
						title: label
					}
				);

				// store some extra data on the marker
				var md = marker.metaData = {};
				if (sample) {
					md.sampleCid = sample.cid;
					if(sample.get('msgId') !== undefined)
						md.msgId = sample.get('msgId');
					if (sample.get('sessionId') !== undefined)
						md.sessionId = sample.get('sessionId');
				}

				// register the marker
				if (type !== undefined) {
					this.registerOverlay(type, marker);
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
			 * Creates a line overlay connecting measured and calculated points.
			 * @param {LatLng} startLatLng: the geographical position for the start of the line
			 * @param {LatLng} endLatLng: the geographical position for the end of the line
			 */
			drawReferenceLine: function(startLatLng, endLatLng) {

				if (this.appsettings.get("drawReferenceLines"))
					this.createLine([startLatLng, endLatLng], "#FF0000", 1, OverlayTypes.REFERENCELINE);
			},

			/**
			 * Draws polylines connecting all reference locations and best-candidate locations in a session.
			 */
			drawSessionLines: function(session) {

				// check if the session actually changed
				if (this.highlightedSessionId !== session.id) {

					// remove old lines and markers
					this.deleteOverlaysForType(OverlayTypes.SESSIONVIZ);
					this.deleteOverlaysForType(OverlayTypes.CANDIDATEMARKER);

					this.highlightedSessionId = session.id;

					// draw new lines
					if (this.appsettings.get("drawSessionLines") &&
						session.results &&
						session.results.length > 1) {

						var refLocations = [],
							bestLocations = [];

						// extract the non-NaN locations
						session.results.each(function(sample) {

							var latLng = sample.get("latLng");
							if (!(isNaN(latLng.lat()) || isNaN(latLng.lng())))
								refLocations.push(latLng);

							if (sample instanceof AccuracyResult) {
								latLng = sample.getBestLocationCandidate().get("latLng");
								if (!(isNaN(latLng.lat()) || isNaN(latLng.lng())))
									bestLocations.push(latLng);
							}
						});

						this.createLine(refLocations, "#4AB0F5", 10, OverlayTypes.SESSIONVIZ);
						this.createLine(bestLocations, "#B479FF", 7, OverlayTypes.SESSIONVIZ);
					}
				}
			},

			/**
			 * Creates a polyline overlay and adds it to the map.
			 * @param {Array} points: array of LatLng positions for the polyline
			 * @param {String} color: a hexadecimal HTML color of the format "#FFFFFF"
			 * @param {int} weight: line weight in pixels
			 * @param {OverlayTypes} type: the type of the overlay
			 */
			createLine: function(points, color, weight, type) {

				if (points && points.length > 1) {

					var line = new google.maps.Polyline(
						{
							path: points,
							strokeColor: color,
							strokeOpacity: 0.8,
							strokeWeight: weight
						}
					);
					line.setMap(this.map);

					this.registerOverlay(type, line);
				}
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
			onMarkerClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.sessionId !== undefined &&
						md.sessionId > 0) {

						var session = this.collection.get(md.sessionId);
						if (session) {
							var sample = session.getByCid(md.sampleCid);
							if (sample) {
								this.trigger("result:selected", sample);
							}
							this.trigger("session:selected", session);
						}
					}
				}
			},

			/**
			 * Handler for double-clicks on map markers.
			 */
			onMarkerDblClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.sessionId !== undefined &&
						md.sessionId > 0) {

						var session = this.collection.get(md.sessionId);
						if (session) {
							// connect session results
							this.drawSessionLines(session);

							if (md.type !== undefined &&
								md.type === OverlayTypes.GEOLOCMARKER &&
								md.sampleCid !== undefined) {

								// draw location candidates
								var sample = session.getByCid(md.sampleCid);
								if (sample && sample instanceof AccuracyResult) {
									this.drawCandidateMarkers(sample);
								}
							}
							else {
								// type unknown or "not geoloc"
								this.deleteCandidateMarkers();
							}
						}
					}
				}
			},

			/**
			 * Focus on a session by zooming to its bounds.
			 * @param {Session} session The session model.
			 */
			focusSession: function(session) {

				// determine the extents of the session
				var sessionRect = new google.maps.LatLngBounds();

				session.results.each(function(sample) {

					sessionRect.extend(sample.get('latLng'));

					if (sample instanceof AccuracyResult) {
						var bestCand = sample.getBestLocationCandidate();
						sessionRect.extend(bestCand.get('latLng'));
					}
				});

				if (!sessionRect.isEmpty())
					this.map.fitBounds(sessionRect);
			}
		});

		return MapView;
	}
);
