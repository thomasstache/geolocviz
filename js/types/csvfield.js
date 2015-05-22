define(

	function() {

		/**
		 * Describes a column and its data in a CSV/tabular file.
		 * @param {String} name         The column header
		 * @param {String} type         One of TYPE_STRING, TYPE_FLOAT, TYPE_INTEGER
		 * @param {Object} defaultValue The value to use if the field is absent
		 */
		var CSVField = function(name, type, defaultValue) {
			this.name = name;
			this.type = type;
			this.default = defaultValue;
		};

		Object.defineProperties(CSVField, {
			"TYPE_STRING":  {value: "string"},
			"TYPE_FLOAT":   {value: "float"},
			"TYPE_INTEGER": {value: "int"},
		});

		return CSVField;
	}
);