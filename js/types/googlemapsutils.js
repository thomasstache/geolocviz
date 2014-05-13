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

		/**
		 * Adds a given location to the array, if the location differs from the previous one.
		 * @param  {Array}  latLngArray A collection of LatLng locations
		 * @param  {LatLng} latLng      The new location
		 */
		GoogleMapsUtils.pushIfNew = function (latLngArray, latLng) {
			if (!(latLngArray instanceof Array &&
				  latLng instanceof google.maps.LatLng))
				return;

			if (latLngArray.length === 0 ||
				!latLng.equals(latLngArray[latLngArray.length - 1])) {
				latLngArray.push(latLng);
			}
		};

		return GoogleMapsUtils;
	}
);