// jshint esnext:true
define(
	["types/csvfield", "types/logger", "parsenumber"],

	function(CSVField, Logger, parseNumber) {

		/*
		 * API design:
		 * 1. parse the header and build an index of all fields
		 * 2. iterate over all fields we want, get column index, and extract value from line parts
		 * ? how to deal with normal/extended AXF files?
		 */

		var CSVColumnIndex = function(columnSeparator) {
			this.fieldIndex = {};
			this.knownFields = {};
			this.logger = Logger.getLogger();

			this.columnSeparator = columnSeparator;
		};

		/**
		 * Determines the column indices for the given fields.
		 * @param {Array}  headerParts the header line parts
		 * @param {Object} fields      map of known fields
		 */
		CSVColumnIndex.prototype.prepareForHeader = function(headerParts, fields) {

			this.fieldIndex = {};
			this.knownFields = fields;

			for (var col = 0; col < headerParts.length; col++) {

				// clean up
				var colHeader = headerParts[col].trim();
				if (col === 0 && colHeader.charAt(0) === "#")
					colHeader = colHeader.substr(1);

				for (var key in this.knownFields) {
					var field = this.knownFields[key];
					if (colHeader === field.name) {
						this.fieldIndex[field.name] = col;
					}
				}
			}
		};

		/**
		 * Helper function for picking an attribute value from "record" array.
		 * If the field is not in the index, it returns the field's default value
		 * (which may well be "undefined").
		 * @param  {Array} record   The row items split from the CSV
		 * @param  {CSVField} field The field to retrieve
		 * @return {Object}         The attribute value
		 */
		CSVColumnIndex.prototype.getValueFrom = function(record, field) {

			var val;
			var type = field.type,
				key = field.name;

			// check index
			var colIndex = this.fieldIndex[key];

			if (colIndex !== undefined &&
				colIndex >= 0 && colIndex < record.length) {

				val = record[colIndex];
				// convert to numeric if requested so
				if (type === CSVField.TYPE_FLOAT)
					val = parseNumber(val);
				else if (type === CSVField.TYPE_INTEGER)
					val = parseInt(val, 10);
			}
			else {
				// return default value
				val = field.default;
				// this.logger.debug("Attribute '" + key + "' not found in record.");
			}

			return val;
		};

		return CSVColumnIndex;
	}
);