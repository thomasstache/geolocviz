define(
	["handlebars"],

	function(Handlebars) {

		/**
		 * Handlebars helper to format numeric values with unit.
		 * @param  {Object} context The value passed into the template
		 * @param  {Object} unit    (optional) Text to be appended as unit.
		 * @return {SafeString}
		 */
		function withUnit(context, unit) {

			var result,
				num = typeof context === "number" ? context : parseFloat(context);

			if (!isNaN(num) &&
			    unit !== undefined) {
				result = String(num) + unit;
			}
			else {
				result = num;
			}

			return new Handlebars.SafeString(result);
		}

		Handlebars.registerHelper("withUnit", withUnit);
		return withUnit;
	}
);