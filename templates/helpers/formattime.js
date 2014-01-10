define(
	["handlebars"],

	function(Handlebars) {

		/**
		 * Handlebars helper to format values as readable time stamps.
		 * @param  {Object} context    The value passed into the template, interpreted as milliseconds
		 * @param  {Object} sourceUnit (optional) Unit of the value in context, e.g. "ms".
		 * @return {SafeString}
		 */
		function formatTime(context, sourceUnit) {

			var result,
				num = typeof context === "number" ? context : parseFloat(context);

			if (!isNaN(num)) {
				if (sourceUnit == "ms")
					num = num / 1000;

				// format as seconds
				if (Number.prototype.toLocaleString !== undefined)
					result = num.toLocaleString() + "s";
				else
					result = num.toString(10) + "s";
			}
			else {
				result = num;
			}

			return new Handlebars.SafeString(result);
		}
		Handlebars.registerHelper("formattime", formatTime);
		return formatTime;
	}
);