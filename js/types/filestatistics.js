define(

	function() {
		/**
		 * Information about a loaded file the FileLoader passes back to its caller.
		 * @param {String} filename name of the file
		 * @param {FileTypes} filetype
		 */
		var FileStatistics = function(filename, filetype) {
			this.name = filename;
			this.type = filetype;

			// Number of result records in type "ACCURACY" and "AXF" file
			this.numResults = 0;
			// Number of result records in accuracy file
			this.numResultsAndCandidates = 0;

			// Indicates that AXF file contains reference cell columns
			this.referenceCellsAvailable = false;
		};

		return FileStatistics;
	}
);