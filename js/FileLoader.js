define(
	["underscore",
	 "collections/sessions", "collections/results",
	 "types/filestatistics", "types/filetypes",
	 "loader/resultfileparser", "loader/cellrefparser",
	 "types/logger", "jquery.csv"],

	function(_, SessionList, ResultList, FileStatistics, FileTypes,
			 ResultFileParser, CellrefParser, Logger) {

		/**
		 * Singleton module to parse and load data from files.
		 */
		var FileLoader = (function() {

			/** @type {SessionList} reference to the Sessions collection */
			var sessionList = null;

			/** @type {SiteList} reference to the Sites collection */
			var siteList = null;

			var fileCompleteCallback = null,
				loadCompleteCallback = null;

			// the counter tracking file loads
			var numFilesQueued = 0;

			/** @type {Logger} */
			var logger = null;

			/**
			 * Parse and load a file. Supported types are *.axf, *.distances and *.txt
			 * @param {File} file The file to load
			 */
			function loadFile(file) {

				logger = Logger.getLogger();

				var reader = new FileReader();
				reader.onloadend = function(evt) { onFileReadComplete(evt, file.name); };

				reader.readAsText(file);
			}

			/**
			 * Handler for the loadend event of the FileReader
			 * @param {ProgressEvent} evt The event for access to the data.
			 * @param {String} filename   The name of the file to determine how to parse it.
			 */
			function onFileReadComplete(evt, filename) {
				// evt: ProgressEvent, target is the FileReader
				var rdr = evt.target;

				if (rdr.readyState === FileReader.DONE) {

					var filecontent = rdr.result;

					// check which type of file we're dealing with
					var currentFileType = null;
					var ext = filename.substr(filename.lastIndexOf(".") + 1);
					switch (ext)
					{
						case "distances":
							currentFileType = FileTypes.ACCURACY;
							break;
						case "axf":
							currentFileType = FileTypes.AXF;
							break;
						case "txt":
							// TODO: 20121017 verify assumption that Cellref files are named cellrefs*.txt!
							if (filename.substr(0, 8).toLowerCase() === "cellrefs")
							    currentFileType = FileTypes.CELLREF;
							break;
						default:
							logger.error("Failed to load file '" + filename + "'\n(unrecognized extension: '" + ext + "').");
					}

					if (currentFileType !== null)
						processFileContent(filecontent, filename, currentFileType);
				}
				else {
					logger.error("onFileReadComplete: readyState not 'DONE'! (" + rdr.readyState + ")");
				}

				numFilesQueued--;
				// notify that whole batch is completed
				if (numFilesQueued === 0 &&
					loadCompleteCallback !== null) {
					loadCompleteCallback();
				}
			}

			/**
			 * Shared file processing function for local files and XMLHttpRequest from the server.
			 * @param  {String} filecontent     The text content of the file
			 * @param  {String} filename        The file name as information
			 * @param  {FileTypes} currentFileType for selection of the file parser
			 */
			function processFileContent(filecontent, filename, currentFileType) {

				var bOk = false,
					fileStatistics = new FileStatistics(filename, currentFileType);

				if (currentFileType === null) {
					logger.error("Could not recognize the type of file '" + filename + "'!");
				}
				else {
					// comma for AXF files, TAB for rest (accuracy results and Cellrefs)
					var separator = (currentFileType === FileTypes.AXF) ? "," : "\t";

					// decompose the blob
					var rowData = jQuery.csv(separator)(filecontent);

					try {
						// parse the data
						if (currentFileType === FileTypes.CELLREF)
							bOk = CellrefParser.parse(siteList, rowData);
						else
							bOk = ResultFileParser.parse(sessionList, rowData, currentFileType, fileStatistics);
					}
					catch (e) {
						console.error(e.toString());
						logger.error("There was an error parsing the file '" + filename + "'. Please check the format of the lines for errors.");
					}
				}

				// notify about completion of this file
				if (fileCompleteCallback !== null)
					fileCompleteCallback(bOk, fileStatistics);
			}

			/**
			 * Request a file hosted on our server in the /data folder.
			 * @param  {String} filename     Name of the file
			 * @param  {String} responseType (optional) XMLHttpRequest response type
			 */
			function requestFileFromAppServer(filename, responseType) {

				logger = Logger.getLogger();

				// supported: "arraybuffer", "text", "blob", "document", "json"
				responseType = responseType || "text";

				// we only load files from "/data" on our own server!
				var url = "./data/" + filename;

				var request = new XMLHttpRequest();
				request.open("GET", url, /*async=*/ true);
				request.responseType = responseType;

				request.onloadend = function(evt) { onRequestComplete(evt, filename); };

				request.send();
			}

			/**
			 * Handler for the load event of the XMLHttpRequest
			 * @param {ProgressEvent} evt The event for access to the data.
			 * @param {String} filename   The name of the file to determine how to parse it.
			 */
			function onRequestComplete(evt, filename) {
				var request = evt.target;

				if (request.readyState === XMLHttpRequest.DONE && request.status === 200) {

					var content = request.response;

					// Only Cellref files are supported.
					var filetype = FileTypes.CELLREF;
					processFileContent(content, filename, filetype);
				}
				else {
					logger.error("Failed to load file '" + filename + "'.\n(" + request.status + ": " + request.statusText + ")");
				}

				numFilesQueued--;

				// notify that whole batch is completed
				if (numFilesQueued === 0 &&
					loadCompleteCallback !== null) {
					loadCompleteCallback();
				}
			}

			// return the external API
			return {

				/**
				 * Load all files in the array. Supported types are .axf and .distances
				 * @param {FileList}    files    List of File objects (e.g. as retrieved from a input[type="file"])
				 * @param {SessionList} sessions Session collection
				 * @param {SiteList}    sites    Site collection
				 * @param {Function}    onFileComplete Callback function to call when a file is done
				 * @param {Function}    onLoadComplete Callback function to call when all files are done
				 */
				loadFiles: function(files, sessions, sites, onFileComplete, onLoadComplete) {

					numFilesQueued = files.length;

					if (sessions)
						sessionList = sessions;

					if (sites)
						siteList = sites;

					if (typeof onFileComplete === "function")
						fileCompleteCallback = onFileComplete;
					if (typeof onLoadComplete === "function")
						loadCompleteCallback = onLoadComplete;

					var f;
					for (var i = 0; (f = files[i]); i++) {
						loadFile(f);
					}
				},

				/**
				 * Load the file from the server. Supported types are .axf and .distances
				 * @param {String}      filename Name of the hosted file
				 * @param {SessionList} sessions Session collection
				 * @param {SiteList}    sites    Site collection
				 * @param {Function}    onFileComplete Callback function to call when a file is done
				 * @param {Function}    onLoadComplete Callback function to call when all files are done
				 */
				loadFileFromRepository: function(filename, sessions, sites, onFileComplete, onLoadComplete) {

					numFilesQueued = numFilesQueued + 1;

					if (sessions)
						sessionList = sessions;

					if (sites)
						siteList = sites;

					if (typeof onFileComplete === "function")
						fileCompleteCallback = onFileComplete;
					if (typeof onLoadComplete === "function")
						loadCompleteCallback = onLoadComplete;

					requestFileFromAppServer(filename);
				},

				FileTypes: FileTypes,
			};
		})();

		return FileLoader;
	}
);
