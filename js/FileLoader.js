define(
	["underscore",
	 "collections/sessions", "collections/results",
	 "models/AccuracyResult", "models/axfresult", "models/LocationCandidate", "models/position",
	 "CellrefParser", "jquery.csv"],

	function(_, SessionList, ResultList, AccuracyResult, AxfResult, LocationCandidate, Position, CellrefParser) {

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
				ACCURACY: 11,
				AXF_60: 10,
				AXF_61: 11,
				AXF_XT: 14
			});

			// common Collection.add() options (add silently)
			var OPT_SILENT = Object.freeze({ silent: true });

			// dummy session ID for records from files that don't provide it.
			var SESSION_ID_DEFAULT = 0;

			/** @type {SessionList} reference to the Sessions collection */
			var sessionList = null;

			/** @type {SiteList} reference to the Sites collection */
			var siteList = null;

			var callbackFct = null;

			// reference to the accuracy result while we parse the records with the location candidates
			var currentAccuracyResult = null;

			/**
			 * Parse and load a file. Supported types are *.axf, *.distances and *.txt
			 * @param {File} file The file to load
			 */
			function loadFile(file) {

				var reader = new FileReader();
				// If we use onloadend, we need to check the readyState.
				reader.onloadend = onFileReadComplete;
				reader.file = file;

				reader.readAsBinaryString(file);
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
					var fileStatistics = {
						name: filename
					};

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

					fileStatistics.type = currentFileType;

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
							alert("There was an error parsing the file '" + filename + "'. Please check the format of the lines for errors.");
						}
					}

					// notify about completion of this file (TODO: notify when whole batch is completed!)
					if (callbackFct !== null)
						callbackFct(bOk, fileStatistics);
				}
				else {
					console.log("onFileReadComplete: readyState not 'DONE'! (" + rdr.readyState + ")");
				}
			}

			/**
			 * Parse the array of rows from the file
			 * @param  {Array} rowData          array of row records
			 * @param  {String} currentFileType see FileTypes
			 * @param  {Object} stats           statistics object literal
			 * @return {Boolean} true if successful, false on error (i.e. unknown file format)
			 */
			function processCSV(rowData, currentFileType, stats) {

				currentAccuracyResult = null;

				stats.numResults = 0,
				stats.numResultsAndCandidates = 0;

				var parsingFct = null;
				// identify file format (rudimentary by no. columns)
				var header = rowData[0];

				if (currentFileType == FileTypes.ACCURACY && header.length == LineLengths.ACCURACY) {
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
						  header.length == LineLengths.AXF_XT)) {
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
			 * FileId | MessNum | DTLatitude | DTLongitude | CTLatitude | CTLongitude | Distance | PositionConfidence | MobilityProb | IndoorProb | SessionId
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
					SESSIONID: 10
				});

				var msgId = record[IDX.MSGID];
				var sessId = record[IDX.SESSIONID];

				// when the CT message ID changes, create a new AccuracyResult
				if (currentAccuracyResult === null ||
					currentAccuracyResult.get('msgId') != msgId) {

					// get the session if existing
					var session = getSession(sessId);

					currentAccuracyResult = new AccuracyResult({
						msgId: msgId,
						sessionId: sessId,
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

				currentAccuracyResult.locationCandidates.add(
					new LocationCandidate({
						msgId: msgId,
						position: new Position(parseNumber(record[IDX.GEO_LAT]),
											   parseNumber(record[IDX.GEO_LON])),
						distance: distReported,
						confidence: confidence,
						probMobility: probMobile,
						probIndoor: probIndoor
					}), OPT_SILENT);
				stats.numResultsAndCandidates++;
			}

			/**
			 * Parses a line from the new (v6.1) file format:
			 * Headers:
			 * FileId | MessNum | DTLatitude | DTLongitude | CTLatitude | CTLongitude | Distance | PositionConfidence | MobilityProb | IndoorProb | SessionId | Controller | PrimaryCellId
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
					CELL_ID: 13 // XT
				});

				function percent2Decimal(value) {
					var parsedVal = parseInt(value, 10);
					if (typeof parsedVal === "number")
						value = parsedVal / 100.0;
					return value;
				}

				// indoor probability only in 6.1+
				var probIndoor    = (record.length >= LineLengths.AXF_61) ? record[IDX.PROB_INDOOR] : NaN;

				// session id and primary cell only in extended (XT) files
				var sessionId     = (record.length == LineLengths.AXF_XT) ? record[IDX.SESSIONID] : SESSION_ID_DEFAULT;
				var controllerId  = (record.length == LineLengths.AXF_XT) ? parseNumber(record[IDX.CONTROLLER]) : NaN;
				var primaryCellId = (record.length == LineLengths.AXF_XT) ? parseNumber(record[IDX.CELL_ID]) : NaN;

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
					primaryCellId: primaryCellId
				};

				var session = getSession(sessionId);
				session.results.add(new AxfResult(props), OPT_SILENT);
				stats.numResults++;
			}

			function getSession(sessId) {

				// get the session if existing
				var session = sessionList.get(sessId);
				if (!session) {
					// create missing session
					sessionList.add({
						id: sessId
					}, OPT_SILENT);

					session = sessionList.at(sessionList.length - 1);
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
				 * @param {Array}       files    Array of File objects (e.g. as retrieved from a input[type="file"])
				 * @param {SessionList} sessions Session collection
				 * @param {SiteList}    sites    Site collection
				 * @param {Function}    callback Callback function to call when a file is done
				 */
				loadFiles: function(files, sessions, sites, callback) {

					if (sessions)
						sessionList = sessions;

					if (sites)
						siteList = sites;

					if (typeof callback === "function")
						callbackFct = callback;

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
