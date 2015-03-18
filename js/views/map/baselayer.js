define(
	["underscore", "backbone",
	 "collections/overlays"],

	function(_, Backbone, OverlayList) {

		/**
		 * Basic Map Layer. Collection of some functions the layers share.
		 */
		var BaseLayer = Backbone.View.extend({

			constructor: function BaseLayer() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			/** @type {google.maps.Map} the Google Maps control */
			map: null,

			/** @type {AppState} the shared app state */
			appstate: null,
			/** @type {Settings} the settings model */
			settings: null,

			/** @type {LatLngBounds} bounding rectangle around the layer's objects */
			bounds: null,

			/** @type {OverlayList} collection of map objects managed by this layer */
			overlays: null,

			initialize: function(options) {

				this.settings = options.settings;
				this.appstate = options.appstate;
				this.map = options.map;

				// a collection to keep our overlays in sight
				this.overlays = new OverlayList();

				this.resetBounds();
			},

			/****     Bounds     ****/

			getBounds: function() {
				return this.bounds;
			},

			/**
			 * Resets the view bounds rectangle
			 */
			resetBounds: function() {
				this.bounds = new google.maps.LatLngBounds();
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

		});

		return BaseLayer;
	}
);