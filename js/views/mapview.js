define(
	["underscore", "backbone",
	 "collections/overlays"],
	function(_, Backbone, OverlayList) {

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

		// a percentage formatter assuming values [0,1], omitting unit for NaNs
		function asPercent(val) {
			return isNaN(val) ? val
							  : Math.round(val * 100) + "%";
		}

		var MapView = Backbone.View.extend({

			el: $("#mapContainer"),

			bounds: null,

			// collection of all map objects
			overlays: null,

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

					var refLoc = sample.get('latLngRef');

					// some sample files contain "NaN" coordinates. using them messes up the map and the bounding box.
					if (!isNaN(refLoc.lat()) && !isNaN(refLoc.lng())) {

						view.bounds.extend(refLoc);

						view.createMarker(refLoc,
										  "#" + sample.get('msgId'),
										  "Session: " + session.id +
										  "<br>Messages: " + session.results.length,
										  MarkerColors.REFERENCE,
										  sample, OverlayTypes.REFERENCEMARKER);
					}

					var bestCand = sample.getBestLocationCandidate();
					var bestLoc = bestCand.get('latLng');
					var color = (bestCand.category() == "S") ? MarkerColors.STATIONARY
							  : (bestCand.category() == "I") ? MarkerColors.INDOOR
							  : MarkerColors.GEOLOCATED;

					view.createMarker(bestLoc,
									  "#" + sample.get('msgId'),
									  "Distance: " + bestCand.get('distance') + "m" +
									  "<br>Confidence: " + asPercent(bestCand.get('confidence')) +
									  "<br>P_mobile: " + asPercent(bestCand.get('probMobility')) +
									  "<br>P_indoor: " + asPercent(bestCand.get('probIndoor')) +
									  "<br>Candidates: " + sample.locationCandidates.length,
									  color,
									  sample, OverlayTypes.GEOLOCMARKER);

					view.bounds.extend(bestLoc);

					// connect measured and calculated points with lines
					view.drawReferenceLine(refLoc, bestLoc);
				});
			},

			/**
			 * Creates a marker pin and adds it to the map.
			 * @param {LatLng} latlng: the geographical position for the marker
			 * @param {String} label: headline for the info popup
			 * @param {String} detailHtml: body for the info popup
			 * @param {MarkerColors} colorDef: the color definition to use
			 * @param {AccuracyResult} sample: reference to the AccuracyResult for which the marker is created
			 * @param {OverlayTypes} type: the type of the marker
			 */
			createMarker: function(latlng, label, detailHtml, colorDef, sample, type) {

				var view = this;
				var contentString = '<b>' + label + '</b><br>' + detailHtml,
					color = colorDef.bgcolor + "|" + colorDef.color,
					letter = colorDef.smb;

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
				md.infoText = contentString;
				if (sample) {
					md.sampleId = sample.cid;
					if(sample.get('msgId') !== undefined)
						md.msgId = sample.get('msgId');
					if (sample.get('sessionId') !== undefined)
						md.sessionId = sample.get('sessionId');
				}

				// register the marker
				this.registerOverlay(type, marker);

				// click event to the for the marker
				google.maps.event.addListener(marker, 'click',
					function() {
//						onMarkerClick(this);
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

				if (this.appsettings.get("drawSessionLines") &&
				    session.results &&
					session.results.length > 1) {

					var refLocations = [],
						bestLocations = [];

					// extract the non-NaN locations
					session.results.each(function(sample) {

						var latLng = sample.get("latLngRef");
						if (!(isNaN(latLng.lat()) || isNaN(latLng.lng())))
							refLocations.push(latLng);
						latLng = sample.getBestLocationCandidate().get("latLng");
						if (!(isNaN(latLng.lat()) || isNaN(latLng.lng())))
							bestLocations.push(latLng);
					});

					this.createLine(refLocations, "#4AB0F5", 10, OverlayTypes.SESSIONVIZ);
					this.createLine(bestLocations, "#B479FF", 7, OverlayTypes.SESSIONVIZ);
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
			 * Highlights the records associated with the session of the marker.
			 */
			onMarkerDblClick: function(marker) {

				this.deleteOverlaysForType(OverlayTypes.SESSIONVIZ);
				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.sessionId !== undefined &&
						md.sessionId > 0) {

						var session = this.collection.get(md.sessionId);
						if (session) {
							this.drawSessionLines(session);
							this.trigger("session:selected", session);
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

					sessionRect.extend(sample.get('latLngRef'));
					var bestCand = sample.getBestLocationCandidate();
					sessionRect.extend(bestCand.get('latLng'));
				});

				if (!sessionRect.isEmpty())
					this.map.fitBounds(sessionRect);
			}
		});

		return MapView;
	}
);
