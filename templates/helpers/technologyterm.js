define(
	["handlebars"],

	function(Handlebars) {

		var NetSegmentNames = Object.freeze({
			unknown: "Seg",
			GSM: "LAC",
			UMTS: "RNCID",
			LTE: "TAC"
		});

		/**
		 * Handlebars helper to lookup technology-specific terms.
		 * @param  {String} technology one of the TECH_GSM... constants in the Site model
		 * @param  {String} term       key for the technology-specific term
		 * @return {SafeString}
		 */
		function getTechnologyTerm(technology, term) {

			var result;

			switch (term) {
				case "netsegment":
					result = NetSegmentNames[technology];
					break;
			}

			return new Handlebars.SafeString(result);
		}

		Handlebars.registerHelper("technologyterm", getTechnologyTerm);
		return getTechnologyTerm;
	}
);