define(

	function() {
		/**
		 * Parameters for filtering network elements on the map.
		 * @param {Enum}   elementType One of the types defined below
		 * @param {Object} properties  Attributes and their values to find
		 */
		function ElementFilterQuery(elementType, properties) {
			this.elementType = elementType;
			this.properties = properties;
		}

		Object.defineProperty(ElementFilterQuery, "ELEMENT_SECTOR", { value: "sector" });
		// Object.defineProperty(ElementFilterQuery, "ELEMENT_SITE", { value: "site" });

		return ElementFilterQuery;
	}
);