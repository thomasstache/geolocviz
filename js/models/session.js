define(
	["underscore", "backbone",
	 "collections/results", "models/AccuracyResult",
	 "types/googlemapsutils"],

	function(_, Backbone, ResultList, AccuracyResult, GoogleMapsUtils) {

		var Session = Backbone.Model.extend({

			defaults: {
				// id of the "call" session
				sessionId: null,
				// identifier of the calltrace file
				fileId: null
			},

			/** @type {ResultList} collection of results (with base type BaseResult) */
			results: null,

			initialize: function() {
				// the list of geolocation results
				this.results = new ResultList();
			},

			getInfo: function() {
				var rv = this.toJSON();
				rv.resultCount = this.results.length;

				if (rv.resultCount > 0) {

					rv.confidence = calculateMean(this.results, "confidence");
					rv.probIndoor = calculateMean(this.results, "probIndoor");

					// calculate distance, duration and speed
					var distance_m = calculateDistance(this.results, false);
					rv.distance = Math.round(distance_m);

					// rv.probMobility = this.calculateMean("probMobility");
					// the mobility probability is constant for the whole session, take it from the first result
					var firstResult = this.results.first();
					if (firstResult instanceof AccuracyResult) {

						// for AccuracyResults we can compute the distance between all reference locations
						rv.refDistance = Math.round(calculateDistance(this.results, true));

						rv.probMobility = firstResult.getBestLocationCandidate().get("probMobility");
					}
					else {
						rv.probMobility = firstResult.get("probMobility");
					}

					// some files have no timestamp
					if (firstResult.has("timestamp")) {

						var lastResult = this.results.last(),
							duration_ms = lastResult.get("timestamp") - firstResult.get("timestamp");

						rv.duration = duration_ms;

						if (duration_ms > 0.0) {
							var meanSpeed_m_s = distance_m / (duration_ms / 1000.0);
							rv.meanSpeed = Math.round(meanSpeed_m_s * 3.6 * 10.0) / 10.0;
						}
					}
				}

				return rv;
			},

			/**
			 * Returns the positions of the session's results for heatmap visualizations.
			 * @param {LatLngBounds} bounds
			 * @param {Object} thresholds Indoor/mobility probability thresholds
			 * @return {Array}
			 */
			getPositionsForHeatmap: function(bounds, thresholds) {

				var rv = [],
					latLng = null,
					firstResult = this.results.first();

				// check if we had extended Axf files, i.e. this is not the default session
				var validSessions = this.get("sessionId") > 0;

				// for stationary sessions we can return one WeightedLocation
				if (validSessions &&
					firstResult.category(thresholds) === 'S') {

					latLng = GoogleMapsUtils.makeLatLng(firstResult.getGeoPosition());
					bounds.extend(latLng);
					rv.push({
						location: latLng,
						weight: this.results.length
					});
				}
				else {

					rv = this.results.map(function(result) {
						latLng = GoogleMapsUtils.makeLatLng(result.getGeoPosition());
						bounds.extend(latLng);
						return latLng;
					});
				}

				return rv;
			}
		});

		/**
		 * Calculate the length of the path between all geolocated/reference positions.
		 * @param  {ResultList} results
		 * @param  {Boolean} useRefLocation Indicates which position to get
		 * @return {Number}
		 */
		function calculateDistance(results, useRefLocation) {
			var locations = [];
			results.each(function(result) {
				var pos = useRefLocation ? result.getRefPosition()
										 : result.getGeoPosition();
				GoogleMapsUtils.pushIfNew(locations, GoogleMapsUtils.makeLatLng(pos));
			});
			return GoogleMapsUtils.computeSphericDistance(locations);
		}

		/**
		 * Calculates the arithmetic mean of the attribute of all results in the session.
		 * @param  {ResultList} results
		 * @param  {String} attribute The name of the attribute
		 * @return {Number}
		 */
		function calculateMean(results, attribute) {

			var sum = results.reduce(function(sum, result) {
				return sumAttribute(sum, result, attribute);
			}, 0);

			return sum / results.length;
		}

		/**
		 * Aggregator function for _.reduce() collecting the attribute of all results.
		 * @param  {Number} sum        The map/reduce memo value
		 * @param  {BaseResult} result The result model
		 * @param  {String} attribute  The name of the attribute
		 * @return {Number}            New aggregation result
		 */
		function sumAttribute(sum, result, attribute) {

			if (result instanceof AccuracyResult) {
				result = result.getBestLocationCandidate();
			}

			var data = result.has(attribute) ? result.get(attribute) : 0.0;
			return sum + data;
		}

		return Session;
	}
);
