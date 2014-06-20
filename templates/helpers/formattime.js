define(
	["handlebars"],

	function(Handlebars) {

		var MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

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
				// assume epoch for really large time stamps
				if (num > MILLISECONDS_PER_DAY) {
					var d = new Date(num);

					result = d.toLocaleString("de-DE");
					if (d.getMilliseconds() > 0)
						result += "." + d.getMilliseconds();
				}
				else {
					if (sourceUnit == "ms")
						num = num / 1000;

					// apply locale number format
					if (Number.prototype.toLocaleString !== undefined)
						result = num.toLocaleString();
					else
						result = num.toString(10);
				}
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