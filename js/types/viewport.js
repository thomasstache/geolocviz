define(

	function() {
		var Viewport = function(center, zoom) {
			this.center = center;
			this.zoom = zoom;
		};

		Viewport.prototype.isValid = function() {
			return (this.center instanceof google.maps.LatLng &&
					!isNaN(this.zoom) &&
					!isNaN(this.center.lat()) &&
					!isNaN(this.center.lng()));
		};

		/**
		 * Format the viewport in the canonical form.
		 * @return {String}
		 */
		Viewport.prototype.serialize = function() {
			var text = "/";

			if (this.isValid()) {

				text = "{C:(" + this.center.lat() + "," + this.center.lng() + "),Z:" + this.zoom +"}";
			}

			return text;
		};
		return Viewport;
	}
);