define(

	function() {
		/**
		 * Parameters for filtering or searching network elements.
		 * @param {Enum}   elementType One of the types defined below
		 * @param {Object} properties  Object literal with attributes and their values to match. Or an array of such literals.
		 *  Examples:
		 *    { cellIdentity: sectorProps.primaryCellId, netSegment: sectorProps.controllerId }
		 *    [{ channelNumber: 123 }, { channelNumber: 456 }, { channelNumber: 789 }]
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