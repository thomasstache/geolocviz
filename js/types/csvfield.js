define(

	function() {

		/**
		 * Describes a column and its data in a CSV/tabular file.
		 * @param {String} name     The column header
		 * @param {String} type     One of TYPE_STRING, TYPE_FLOAT, TYPE_INTEGER
		 * @param {Object} options  Value hash, including:
		 *                            defaultValue The value to use if the field is absent
		 *                            required     Whether the presence of the field is mandatory
		 */
		var CSVField = function(name, type, options) {
			options = options || {};

			this.name = name;
			this.type = type;
			this.required = options.required || false;
			this.defaultValue = options.defaultValue || undefined;
		};

		Object.defineProperties(CSVField, {
			"TYPE_STRING":  {value: "string"},
			"TYPE_FLOAT":   {value: "float"},
			"TYPE_INTEGER": {value: "int"},
		});

		return CSVField;
	}
);