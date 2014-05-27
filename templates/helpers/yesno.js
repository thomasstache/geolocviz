define(
	["handlebars"],

	function(Handlebars) {

		/**
		 * Handlebars helper to format values as "yes" or "no".
		 * @param  {Object} context The value passed into the template
		 * @return {SafeString}
		 */
		function yesno(context) {

			return new Handlebars.SafeString(context == true ? "yes" : "no");
		}

		Handlebars.registerHelper("yesno", yesno);
		return yesno;
	}
);