define(
	["underscore", "backbone",
	 "models/overlay", "models/axfresult", "types/googlemapsutils"],

	function(_, Backbone, Overlay, AxfResult, GoogleMapsUtils) {

		var ResultOverlay = Overlay.extend({

			_defaults: {
				/** @type {BaseResult} result model */
				result: null
			},

			defaults: function() {
				return _.defaults(this._defaults, Overlay.prototype.defaults);
			},

			constructor: function ResultOverlay() {
				Overlay.prototype.constructor.apply(this, arguments);
			},

			initialize: function(options) {

				Overlay.prototype.initialize.apply(this, [options]);

				var result = this.get("result");
				if (result &&
					result instanceof AxfResult) {

					this.listenTo(result, "position-reverted", this.onResultReverted);
				}
			},

			removeFromMap: function() {

				var result = this.get("result");
				if (result) {
					this.stopListening(result);
				}

				Overlay.prototype.removeFromMap.apply(this, arguments);
			},

			/**
			 * Handler for the "position-reverted" event of the AxfResult model. Update the marker on the map.
			 */
			onResultReverted: function() {

				var result = this.get("result"),
					marker = this.get("ref");

				// set marker to position value
				if (marker) {

					var newLatLng = GoogleMapsUtils.makeLatLng(result.getGeoPosition());
					marker.setPosition(newLatLng);
				}
			},
		});

		return ResultOverlay;
	}
);
