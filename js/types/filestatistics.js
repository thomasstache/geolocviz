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

			this.numResults = 0;
			this.numResultsAndCandidates = 0;
		};

		return FileStatistics;
	}
);