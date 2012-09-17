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
			SELECTIONVIZ: "selectionViz"
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
				this.collection.on("reset", this.clearMarkers, this);

				// a collection to keep our overlays in sight
				this.overlays = new OverlayList();

				// listen for settings changes
				this.appsettings = this.options.settings;
				this.appsettings.on("change", this.updateFeatures, this);
			},

			// draw all markers for all sessions
			drawMarkers: function() {

				this.bounds = new google.maps.LatLngBounds();
				// capture the "this" scope
				var that = this;
				this.collection.each(function(session) {
					that.drawSession(session);
				});

				if (!this.bounds.isEmpty())
					this.map.fitBounds(this.bounds);
			},

			clearMarkers: function() {

				this.overlays.each(function(marker) {
					marker.clear();
				});
				this.overlays.reset();
			},

			/**
			 * Update map overlay visibility according to current settings.
			 */
			updateFeatures: function() {

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
			},

			// draw reference and geolocated markers for the given session
			drawSession: function(session) {

				var that = this, color;
				session.results.each(function(sample) {

					var refLoc = sample.get('latLngRef');
					that.bounds.extend(refLoc);

					that.createMarker(refLoc,
									  "#" + sample.get('msgId'),
									  "Session: " + session.id +
									  "<br>Messages: " + session.results.length,
									  MarkerColors.REFERENCE,
									  sample, OverlayTypes.REFERENCEMARKER);

					var bestCand = sample.getBestLocationCandidate();
					var bestLoc = bestCand.get('latLng');
					color = (bestCand.category() == "S") ? MarkerColors.STATIONARY
						  : (bestCand.category() == "I") ? MarkerColors.INDOOR
						  : MarkerColors.GEOLOCATED;

					that.createMarker(bestLoc,
										  "#" + sample.id,
										  "Distance: " + bestCand.get('distance') + "m" +
										  "<br>Confidence: " + asPercent(bestCand.get('confidence')) +
										  "<br>P_mobile: " + asPercent(bestCand.get('probMobility')) +
										  "<br>P_indoor: " + asPercent(bestCand.get('probIndoor')) +
										  "<br>Candidates: " + sample.locationCandidates.length,
										  color,
										  sample, OverlayTypes.GEOLOCMARKER);

					that.bounds.extend(bestLoc);

					// connect measured and calculated points with lines
					that.createReferenceLine(refLoc, bestLoc);
				});
			},

			/**
			 *
			 */
			registerOverlay: function(type, overlay) {
				this.overlays.add({
					type: type,
					ref: overlay
				});
			},

			/**
			 * Creates a marker pin and adds it to the map.
			 * @param {LatLng} latlng: the geographical position for the marker
			 * @param {String} label: headline for the info popup
			 * @param {String} detailHtml: body for the info popup
			 * @param {MarkerColors} color: the color definition to use
			 * @param {String} letter: the letter to be drawn on the marker symbol
			 * @param {AccuracyResult} sample: reference to the AccuracyResult for which the marker is created
			 * @param {OverlayTypes} type: the type of the marker
			 */
			createMarker: function(latlng, label, detailHtml, colorDef, sample, type) {

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
					md.id = sample.cid;
					if(sample.get('msgId') !== undefined)
						md.sampleId = sample.get('msgId');
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
						// "this" is bound to the marker
//						onMarkerDblClick(this);
					}
				);

				return marker;
			},

			/**
			 * Creates a line overlay connecting measured and calculated points.
			 * @param {LatLng} startLatLng: the geographical position for the start of the line
			 * @param {LatLng} endLatLng: the geographical position for the end of the line
			 */
			createReferenceLine: function(startLatLng, endLatLng) {
				return this.createLine(startLatLng, endLatLng, "#FF0000", 1, OverlayTypes.REFERENCELINE);
			},

			/**
			 * Creates a line marker and adds it to the map.
			 * @param {LatLng} startLatLng: the geographical position for the start of the line
			 * @param {LatLng} endLatLng: the geographical position for the end of the line
			 * @param {String} color: a hexadecimal HTML color of the format "#FFFFFF"
			 * @param {int} weight: line weight in pixels
			 * @param {OverlayTypes} type: the type of the overlay
			 */
			createLine: function(startLatLng, endLatLng, color, weight, type) {

				var line = new google.maps.Polyline(
					{
						path: [startLatLng, endLatLng],
						strokeColor: color,
						strokeOpacity: 0.8,
						strokeWeight: weight
					}
				);
				line.setMap(this.map);

				this.registerOverlay(type, line);
				return line;
			}
		});

		return MapView;
	}
);
