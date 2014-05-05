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

		/**
		 * Parse text serialization of a Viewport.
		 * @param {String} text
		 */
		Viewport.prototype.parse = function(text) {
			// expected format: latitude/longitude as decimals, zoom as positive integer
			// e.g. "{C:(-51.049035,13.73744),Z:12}"
			var re = /{C:\((-?[0-9.]+),(-?[0-9.]+)\),Z:(\d+)}/;
			var parts = text.match(re);

			if (parts !== null && parts.length === 4){
				var lat = parseFloat(parts[1]),
					lng = parseFloat(parts[2]),
					zoom = parseFloat(parts[3]);

				this.center = new google.maps.LatLng(lat, lng);
				this.zoom = zoom;
			}
		};

		return Viewport;
	}
);