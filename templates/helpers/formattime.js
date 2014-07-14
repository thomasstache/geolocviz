define(
	["handlebars"],

	function(Handlebars) {

		var MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

		/**
		 * Handlebars helper to format values as readable time stamps.
		 * @param  {Object} context    The value passed into the template, interpreted as milliseconds
		 * @param  {Object} sourceUnit (optional) Unit of the value in context, e.g. "ms".
		 * @param  {Object} options    Specify the number of fractional digits like "digits=5"
		 * @return {SafeString}
		 */
		function formatTime(context, sourceUnit, options) {

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

					// round the seconds
					if (options.hash && options.hash.digits) {
						result = num.toFixed(options.hash.digits);
					}
					else {
						result = num.toString();
					}
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