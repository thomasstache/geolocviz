define(
	["handlebars"],

	function(Handlebars) {

		/**
		 * Handlebars helper to round values to a given number of digits.
		 * @param  {Object} value   The value passed into the template
		 * @param  {Object} options Specify the number of fractional digits like "digits=5"
		 * @return {SafeString}
		 */
		function roundNumber(value, options) {

			var result,
				num = typeof value === "number" ? value : parseFloat(value);

			// number of fractional digits, default is 2
			var digits = options.hash.digits || 2;

			if (!isNaN(num)) {
				var factor = Math.pow(10, digits);
				result = Math.round(num * factor) / factor;
			}
			else {
				result = num;
			}

			return new Handlebars.SafeString(result);
		}

		Handlebars.registerHelper("roundNumber", roundNumber);
		return roundNumber;
	}
);