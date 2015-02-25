define(

	function() {
		/**
		 * Helper function to validate and convert numeric values.
		 * @param  {String} text
		 * @return {Number}
		 */
		function parseNumber(text) {
			if (text === undefined)
				return NaN;

			if (typeof text === "number")
				return text;

			if (typeof text === "string" && text.indexOf(",") > 0)
				text = text.replace(",", ".");

			return parseFloat(text);
		}

		return parseNumber;
	}
);