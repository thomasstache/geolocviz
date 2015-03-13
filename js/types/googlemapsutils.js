define(
	["types/position"],

	function(Position) {
		function GoogleMapsUtils() {}

		GoogleMapsUtils.makeLatLng = function(pos) {

			var latLng;
			if (pos instanceof Position) {
				latLng = new google.maps.LatLng(pos.lat, pos.lon);
			}
			return latLng;
		};

		/** Convert a LatLng into a Position. */
		GoogleMapsUtils.makePosition = function(latLng) {
			if (!latLng instanceof google.maps.LatLng)
				return;

			return new Position(latLng.lat(), latLng.lng());
		};

		/**
		 * Adds a given location to the array, if the location differs from the previous one.
		 * @param  {Array}  latLngArray A collection of LatLng locations
		 * @param  {LatLng} latLng      The new location
		 */
		GoogleMapsUtils.pushIfNew = function (latLngArray, latLng) {
			if (!(latLngArray instanceof Array &&
				  latLng instanceof google.maps.LatLng))
				return;

			if (isNaN(latLng.lat()) || isNaN(latLng.lng()))
				return;

			if (latLngArray.length === 0 ||
				!latLng.equals(latLngArray[latLngArray.length - 1])) {
				latLngArray.push(latLng);
			}
		};

		/**
		 * Computes the length of a path using the Google Maps Geometry library.
		 * @param  {Array} latLngArray A collection of LatLng locations
		 * @return {Number}            path length in meters
		 */
		GoogleMapsUtils.computeSphericDistance = function(latLngArray) {
			return google.maps.geometry.spherical.computeLength(latLngArray);
		};

		return GoogleMapsUtils;
	}
);