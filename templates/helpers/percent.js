define(
	["handlebars"],

	function(Handlebars) {

		/**
		 * Handlebars helper to format values as percentages.
		 * @param  {Object} context The value passed into the template
		 * @return {SafeString}
		 */
		function asPercent(context) {

			var result,
				num = typeof context === "number" ? context : parseFloat(context);

			if (!isNaN(num)) {
				num = Math.round(num * 100);
				result = num + "%";
			}
			else {
				result = num;
			}

			return new Handlebars.SafeString(result);
		}
		Handlebars.registerHelper("percent", asPercent);
		return asPercent;
	}
);