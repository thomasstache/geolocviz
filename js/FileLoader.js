define(
	["underscore",
	 "collections/sessions", "collections/results",
	 "models/AccuracyResult", "models/axfresult", "models/LocationCandidate", "types/position", "types/filestatistics",
	 "CellrefParser", "jquery.csv"],

	function(_, SessionList, ResultList, AccuracyResult, AxfResult, LocationCandidate, Position, FileStatistics, CellrefParser) {

		/**
		 * Singleton module to parse and load data from files.
		 */
		var FileLoader = (function() {

			var FileTypes = Object.freeze({
				ACCURACY: "accuracy",
				AXF: "axf",
				CELLREF: "cells",
			});

			// line/header lengths of the supported CSV files
			var LineLengths = Object.freeze({
				ACCURACY_60: 9,
				ACCURACY_61: 11,
				ACCURACY_612: 13,
				AXF_60: 10,
				AXF_61: 11,
				AXF_XT: 14, /* with primary cells */
				AXF_XT2: 16, /* with ref cells */
			});

			// common Collection.add() options (add silently)
			var OPT_SILENT = { silent: true };

			// dummy session ID for records from files that don't provide it.
			var SESSION_ID_DEFAULT = 0;

			/** @type {SessionList} reference to the Sessions collection */
			var sessionList = null;

			/** @type {SiteList} reference to the Sites collection */
			var siteList = null;

			var fileCompleteCallback = null,
				loadCompleteCallback = null;

			// reference to the accuracy result while we parse the records with the location candidates
			var currentAccuracyResult = null;

			// the counter tracking file loads
			var numFilesQueued = 0;

			/**
			 * Parse and load a file. Supported types are *.axf, *.distances and *.txt
			 * @param {File} file The file to load
			 */
			function loadFile(file) {

				var reader = new FileReader();
				// If we use onloadend, we need to check the readyState.
				reader.onloadend = onFileReadComplete;
				reader.file = file;

				reader.readAsText(file);
			}

			/**
			 * Handler for the loadend event of the FileReader
			 * @param  {Event} evt the ProgressEvent
			 */
			function onFileReadComplete(evt) {
				// evt: ProgressEvent, target is the FileReader
				var rdr = evt.target;
				var rowData = [];

				if (rdr.readyState === FileReader.DONE) {

					// the current file should be tucked on the Reader object
					var filename = rdr.file ? rdr.file.name : "";

					var bOk = false;

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
							currentFileType = null;
					}

					var fileStatistics = new FileStatistics(filename, currentFileType);

					if (currentFileType === null) {
						alert("Could not recognize this file type!");
					}
					else {
						// comma for AXF files, TAB for rest (accuracy results and Cellrefs)
						var separator = (currentFileType === FileTypes.AXF) ? "," : "\t";

						// decompose the blob
						rowData = jQuery.csv(separator)(rdr.result);

						try {
							// parse the data
							if (currentFileType === FileTypes.CELLREF)
								bOk = CellrefParser.parse(siteList, rowData);
							else
								bOk = processCSV(rowData, currentFileType, fileStatistics);
						}
						catch (e) {
							console.error(e.toString());
							alert("There was an error parsing the file '" + filename + "'. Please check the format of the lines for errors.");
						}
					}

					// notify about completion of this file
					if (fileCompleteCallback !== null)
						fileCompleteCallback(bOk, fileStatistics);
				}
				else {
					console.log("onFileReadComplete: readyState not 'DONE'! (" + rdr.readyState + ")");
				}

				numFilesQueued--;
				// notify that whole batch is completed
				if (numFilesQueued === 0 &&
					loadCompleteCallback !== null) {
					loadCompleteCallback();
				}
			}

			/**
			 * Parse the array of rows from the file
			 * @param  {Array} rowData          array of row records
			 * @param  {String} currentFileType see FileTypes
			 * @param  {FileStatistics} stats   reference to statistics about the current file
			 * @return {Boolean} true if successful, false on error (i.e. unknown file format)
			 */
			function processCSV(rowData, currentFileType, stats) {

				currentAccuracyResult = null;

				stats.numResults = 0;
				stats.numResultsAndCandidates = 0;

				var parsingFct = null;
				// identify file format (rudimentary by no. columns)
				var header = rowData[0];

				if (currentFileType == FileTypes.ACCURACY &&
					(header.length == LineLengths.ACCURACY_61 ||
					 header.length == LineLengths.ACCURACY_612)) {
					parsingFct = parseAccuracyRecordV3;
				}
				else if (currentFileType == FileTypes.ACCURACY &&
				         header.length == LineLengths.ACCURACY_60) {
					alert("'Geotagging 1' accuracy results are currently not supported!");
					return false;
				}
				else if (currentFileType == FileTypes.AXF &&
						 (header.length == LineLengths.AXF_60 ||
						  header.length == LineLengths.AXF_61 ||
						  header.length == LineLengths.AXF_XT ||
						  header.length == LineLengths.AXF_XT2)) {
					parsingFct = parseAxfRecord;
				}

				if (!parsingFct) {
					alert("Could not recognize this file's CSV format!");
					return false;
				}

				for (var ct = 1; ct < rowData.length; ct++) {
					parsingFct(rowData[ct], stats);
				}

				currentAccuracyResult = null; // release
				sessionList.trigger('add');
				return true;
			}

			/**
			 * Parses a line from the new (v6.1) file format:
			 * Headers:
			 * FileId | MessNum | DTLatitude | DTLongitude | CTLatitude | CTLongitude | Distance | PositionConfidence | MobilityProb | IndoorProb | SessionId | Controller | PrimaryCellId
			 *
			 * @param {Array} record         array of data fields
			 * @param {FileStatistics} stats reference to statistics about the current file
			 */
			function parseAccuracyRecordV3(record, stats) {

				var IDX = Object.freeze({
					FILEID: 0,
					MSGID: 1,
					REF_LAT: 2,
					REF_LON: 3,
					GEO_LAT: 4,
					GEO_LON: 5,
					DIST: 6,
					CONF: 7,
					PROB_MOB: 8,
					PROB_INDOOR: 9,
					SESSIONID: 10,
					CONTROLLER: 11, // 6.1.2+
					PRIM_CELL_ID: 12,
				});

				var fileId = record[IDX.FILEID];
				var msgId = record[IDX.MSGID];
				var sessId = record[IDX.SESSIONID];
				// the same SessionId can appear in multiple calltrace files, make unique.
				var sessionUId = makeSessionUId(fileId, sessId);
				// also store original identifiers
				var additionalProps = {
					fileId: fileId,
					sessionId: sessId
				};

				// when the CT message ID changes, create a new AccuracyResult
				if (currentAccuracyResult === null ||
					currentAccuracyResult.get('msgId') != msgId) {

					// get the session if existing
					var session = getSession(sessionUId, additionalProps);

					currentAccuracyResult = new AccuracyResult({
						msgId: msgId,
						sessionId: sessionUId,
						position: new Position(parseNumber(record[IDX.REF_LAT]),
											   parseNumber(record[IDX.REF_LON]))
					});
					session.results.add(currentAccuracyResult, OPT_SILENT);
					stats.numResults++;
				}

				var confidence = record[IDX.CONF];
				var probMobile = record[IDX.PROB_MOB];
				var probIndoor = record[IDX.PROB_INDOOR];

				var distReported = record[IDX.DIST];

				var controllerId  = (record.length == LineLengths.ACCURACY_612) ? parseNumber(record[IDX.CONTROLLER]) : NaN;
				var primaryCellId = (record.length == LineLengths.ACCURACY_612) ? parseNumber(record[IDX.PRIM_CELL_ID]) : NaN;

				var props = {
					msgId: msgId,
					position: new Position(parseNumber(record[IDX.GEO_LAT]),
										   parseNumber(record[IDX.GEO_LON])),
					distance: distReported,
					confidence: confidence,
					probMobility: probMobile,
					probIndoor: probIndoor,
					controllerId: controllerId,
					primaryCellId: primaryCellId
				};
				currentAccuracyResult.locationCandidates.add(
					new LocationCandidate(props), OPT_SILENT);
				stats.numResultsAndCandidates++;
			}

			/**
			 * Parses a line from the new (v6.1) file format:
			 * Headers:
			 * FileId | MessNum | DTLatitude | DTLongitude | CTLatitude | CTLongitude | Distance | PositionConfidence | MobilityProb | IndoorProb | SessionId | Controller | PrimaryCellId
			 *
			 * @param {Array} record         array of data fields
			 * @param {FileStatistics} stats A reference to statistics about the current file
			 */
			function parseAxfRecord(record, stats) {
				//to do: Replace column numbers by link related to col headings
				var IDX = Object.freeze({
					MSGID: 0,
					TIMEOFFSET: 1,
					GEO_LAT: 2,
					GEO_LON: 3,
					GPS_CONF: 4,
					CONF: 5,
					PROB_MOB: 6,
					MOBILE_YN: 7,
					INDOOR_YN: 8,
					MEAS_REPORT: 9,
					PROB_INDOOR: 10, // 6.1
					SESSIONID: 11, // XT
					CONTROLLER: 12, // XT
					PRIM_CELL_ID: 13, // XT
					REF_CONTROLLER: 14, // XT2
					REF_CELL_ID: 15, // XT2
				});

				function percent2Decimal(value) {
					var parsedVal = parseInt(value, 10);
					if (typeof parsedVal === "number")
						value = parsedVal / 100.0;
					return value;
				}

				var isExtended = record.length == LineLengths.AXF_XT || record.length == LineLengths.AXF_XT2;
				var isExtended2 = record.length == LineLengths.AXF_XT2;

				// indoor probability only in 6.1+
				var probIndoor    = (record.length >= LineLengths.AXF_61) ? record[IDX.PROB_INDOOR] : NaN;

				// session id and primary cell only in extended (XT) files
				var sessionId     = isExtended ? record[IDX.SESSIONID] : SESSION_ID_DEFAULT;
				var controllerId  = isExtended ? parseNumber(record[IDX.CONTROLLER]) : NaN;
				var primaryCellId = isExtended ? parseNumber(record[IDX.PRIM_CELL_ID]) : NaN;
				var refControllerId = isExtended2 ? parseNumber(record[IDX.REF_CONTROLLER]) : NaN;
				var referenceCellId = isExtended2 ? parseNumber(record[IDX.REF_CELL_ID]) : NaN;

				var sessionProperties = {
					sessionId: sessionId
				};

				var props = {
					msgId: parseNumber(record[IDX.MSGID]),
					sessionId: sessionId, // intentionally as String, as it gets very long
					timestamp: parseNumber(record[IDX.TIMEOFFSET]),
					position: new Position(parseNumber(record[IDX.GEO_LAT]),
										   parseNumber(record[IDX.GEO_LON])),
					confidence: percent2Decimal(record[IDX.CONF]),
					probMobility: percent2Decimal(record[IDX.PROB_MOB]),
					probIndoor: percent2Decimal(probIndoor),
					controllerId: controllerId,
					primaryCellId: primaryCellId,
					refControllerId: refControllerId,
					referenceCellId: referenceCellId,
				};

				var session = getSession(sessionId, sessionProperties);
				session.results.add(new AxfResult(props), OPT_SILENT);
				stats.numResults++;
			}

			/**
			 * Generates a unique ID for a session as a combination of numeric ID and calltrace file ID.
			 * @param  {String} fileId
			 * @param  {String} sessionId
			 * @return {String}
			 */
			function makeSessionUId(fileId, sessionId) {

				return fileId + "__" + sessionId;
			}

			/**
			 * Returns the session with the given Id from the sessionList collection. If none exists yet, it is created.
			 * @param  {String} sessionId       Unique Id of the session
			 * @param  {Object} additionalProps Additional properties to store if a new session is created.
			 * @return {Session}
			 */
			function getSession(sessionId, additionalProps) {

				// get the session if existing
				var session = sessionList.get(sessionId);
				if (!session) {
					// create missing session
					sessionList.add({
						id: sessionId
					}, OPT_SILENT);

					session = sessionList.at(sessionList.length - 1);

					if (additionalProps !== undefined) {
						session.set(additionalProps);
					}
				}
				return session;
			}

			/**
			 * Helper function to validate and convert numeric values.
			 */
			function parseNumber(text) {
				if (typeof text === "number")
					return text;

				if (text.indexOf(",") > 0)
					text = text.replace(",", ".");

				return parseFloat(text);
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

				FileTypes: FileTypes,
			};
		})();

		return FileLoader;
	}
);
