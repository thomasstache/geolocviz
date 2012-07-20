define(
	["underscore", "backbone"],
	function(_, Backbone) {

		// marker types 'n colors
		var MarkerColors = Object.freeze({
			REFERENCE: 	{ bgcolor: "0000FF", color: "FFFFFF", smb: "R", category: "Reference Marker" }, // blue
			GEOLOCATED: { bgcolor: "FF0000", color: "FFFFFF", smb: "M", category: "Geolocated" }, // red
			INDOOR: 	{ bgcolor: "FBEC5D", color: "000000", smb: "I", category: "Indoor" }, // yellow
			STATIONARY: { bgcolor: "FF9900", color: "000000", smb: "S", category: "Stationary" }, // orange
			CANDIDATE: 	{ bgcolor: "CCFFFF", color: "000000", smb: "C", category: "Location Candidate" }, // skyblue
			ACTIX: 		{ bgcolor: "006983", color: "CCCCCC", smb: "A", category: "Home" },
		});

		var MapView = Backbone.View.extend({

			el: $("#mapContainer"),

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
			},

			drawMarkers: function() {
				//
				_.each(this.collection, createMarker);
			},

			clearMarkers: function() {
				//
			},

			drawSession: function(session) {
				;
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
						map: map,
						icon: new google.maps.MarkerImage(iconUrl, null, null, new google.maps.Point(8, 34)),
						title: label,
						zIndex: Math.round(latlng.lat()*-100000)<<5
					}
				);

				// store some extra data on the marker
				marker.metaData = {};
				if (sample && sample.id !== undefined)
					marker.metaData.sampleId = sample.id;
				if (sample && sample.sessionId !== undefined)
					marker.metaData.sessionId = sample.sessionId;
				if (type !== undefined) {
					marker.metaData.type = type;
					registerOverlay(type, marker);
				}

				// click event to the for the marker
				google.maps.event.addListener(marker, 'click',
					function() {
						infowindow.setContent(contentString);
						infowindow.open(map,marker);
						onMarkerClick(this);
					}
				);
				google.maps.event.addListener(marker, 'dblclick',
					function() {
						// "this" is bound to the marker
						onMarkerDblClick(this);
					}
				);

				return marker;
			},
		});

		return MapView;
	}
);
