define(
	["collections/sessions", "collections/results",
	 "models/session", "models/AccuracyResult", "models/axfresult", "models/LocationCandidate",
	 "types/position", "types/filestatistics", "types/filetypes",
	 "types/csvfield", "loader/csvcolumnindex",
	 "types/logger", "parsenumber"],

	function(SessionList, ResultList, Session, AccuracyResult, AxfResult, LocationCandidate,
			 Position, FileStatistics, FileTypes, CSVField, CSVColumnIndex, Logger, parseNumber) {

		var ResultFileParser = (function() {

			// common Collection.add() options (add silently)
			var OPT_SILENT = { silent: true };

			// line/header lengths of the supported CSV files
			var LineLengths = Object.freeze({
				ACCURACY_60: 9,
				ACCURACY_61: 11,
				ACCURACY_612: 13,
				ACCURACY_64: 14, /* with timestamp */
				AXF_60: 10,
				AXF_61: 11,
				AXF_XT: 14, /* with primary cells */
				AXF_XT2: 16, /* with ref cells */
			});

			// definition of supported fields
			var AXF_FIELDS = Object.freeze({
				MSGID:          new CSVField("Message Number",                   CSVField.TYPE_INTEGER),
				TIME:           new CSVField("Time",                             CSVField.TYPE_INTEGER),
				GEO_LAT:        new CSVField("Latitude",                         CSVField.TYPE_FLOAT),
				GEO_LON:        new CSVField("Longitude",                        CSVField.TYPE_FLOAT),
				GPS_CONF:       new CSVField("GPS_Confidence",                   CSVField.TYPE_STRING),
				CONF:           new CSVField("Data_Position_Confidence",         CSVField.TYPE_INTEGER),
				PROB_MOB:       new CSVField("Mobility_Probability",             CSVField.TYPE_INTEGER),
				MOBILE_YN:      new CSVField("Drive_Session",                    CSVField.TYPE_STRING),
				INDOOR_YN:      new CSVField("IndoorOutdoor_Session",            CSVField.TYPE_STRING),
				MEAS_REPORT:    new CSVField("MeasurementReport",                CSVField.TYPE_INTEGER),
				PROB_INDOOR:    new CSVField("Indoor_Probability",               CSVField.TYPE_INTEGER),// 6.1+
				IMSI:           new CSVField("IMSI",                             CSVField.TYPE_STRING),// 7.4+
				SESSIONID:      new CSVField("SessionId",                        CSVField.TYPE_STRING, Session.ID_DUMMY),// XT, intentionally as String, as it gets very long
				CONTROLLER:     new CSVField("Controller",                       CSVField.TYPE_INTEGER, NaN),// XT
				PRIM_CELL_ID:   new CSVField("PrimaryCellId",                    CSVField.TYPE_INTEGER, NaN),// XT
				REF_CONTROLLER: new CSVField("ReferenceController",              CSVField.TYPE_INTEGER, NaN),// XT2
				REF_CELL_ID:    new CSVField("ReferenceCellId",                  CSVField.TYPE_INTEGER, NaN),// XT2
				SCALEFACTOR:    new CSVField("ConfidenceThresholdScalingFactor", CSVField.TYPE_STRING, null),// XT2
			});

			/** @type {SessionList} reference to the Sessions collection */
			var sessionList = null;

			/** @type {CSVColumnIndex} indexer managing extracting result attributes from the row data */
			var columnIndex = null;

			// reference to the accuracy result while we parse the records with the location candidates
			var currentAccuracyResult = null;

			/** @type {Logger} */
			var logger = null;

			/**
			 * Parse the array of rows from the file
			 * @param  {Array} rowData          array of row records
			 * @param  {String} currentFileType see FileTypes
			 * @param  {FileStatistics} stats   reference to statistics about the current file
			 * @return {Boolean} true if successful, false on error (i.e. unknown file format)
			 */
			function processCSV(rowData, currentFileType, stats) {

				logger = Logger.getLogger();

				currentAccuracyResult = null;

				columnIndex = new CSVColumnIndex(",");

				stats.numResults = 0;
				stats.numResultsAndCandidates = 0;

				var parsingFct = null;
				// identify file format (rudimentary by no. columns)
				var header = rowData[0];

				if (currentFileType == FileTypes.ACCURACY &&
					header.length >= LineLengths.ACCURACY_61) {

					parsingFct = parseAccuracyRecordV3;
					columnIndex.prepareForHeader(header, ACCURACY_FIELDS);
				}
				else if (currentFileType == FileTypes.AXF &&
						 header.length >= LineLengths.AXF_60) {

					parsingFct = parseAxfRecord;
					columnIndex.prepareForHeader(header, AXF_FIELDS);
				}
				else if (currentFileType == FileTypes.ACCURACY &&
						 header.length == LineLengths.ACCURACY_60) {
					alert("'Geotagging 1' accuracy results are not supported!");
					return false;
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
					TIME: 13, // 6.4+
				});

				if (record.length < LineLengths.ACCURACY_61) {
					logger.warn("Incomplete accuracy record #" + (stats.numResultsAndCandidates + 1) + " - skipped.");
					return;
				}

				var fileId = record[IDX.FILEID];
				var msgId = parseNumber(record[IDX.MSGID]);
				var sessId = record[IDX.SESSIONID];
				// the same SessionId can appear in multiple calltrace files, make unique.
				var sessionUId = makeSessionUId(fileId, sessId);
				// also store original identifiers
				var additionalProps = {
					fileId: fileId,
					sessionId: sessId
				};

				var timestamp = (record.length >= LineLengths.ACCURACY_64) ? parseNumber(record[IDX.TIME]) : NaN;

				// when the CT message ID changes, create a new AccuracyResult
				if (currentAccuracyResult === null ||
					currentAccuracyResult.get('msgId') != msgId) {

					// get the session if existing
					var session = getSession(sessionUId, additionalProps);

					currentAccuracyResult = new AccuracyResult({
						msgId: msgId,
						timestamp: timestamp,
						sessionId: sessionUId,
						position: new Position(parseNumber(record[IDX.REF_LAT]),
											   parseNumber(record[IDX.REF_LON]))
					});
					session.results.add(currentAccuracyResult, OPT_SILENT);
					stats.numResults++;
				}

				var controllerId  = (record.length >= LineLengths.ACCURACY_612) ? parseNumber(record[IDX.CONTROLLER]) : NaN;
				var primaryCellId = (record.length >= LineLengths.ACCURACY_612) ? parseNumber(record[IDX.PRIM_CELL_ID]) : NaN;

				var props = {
					msgId: msgId,
					position: new Position(parseNumber(record[IDX.GEO_LAT]),
										   parseNumber(record[IDX.GEO_LON])),
					distance: parseNumber(record[IDX.DIST]),
					confidence: parseNumber(record[IDX.CONF]),
					probMobility: parseNumber(record[IDX.PROB_MOB]),
					probIndoor: parseNumber(record[IDX.PROB_INDOOR]),
					controllerId: controllerId,
					primaryCellId: primaryCellId
				};
				currentAccuracyResult.locationCandidates.add(
					new LocationCandidate(props), OPT_SILENT);
				stats.numResultsAndCandidates++;
			}

			function percent2Decimal(value) {
				var parsedVal = parseInt(value, 10);
				if (typeof parsedVal === "number")
					value = parsedVal / 100.0;
				return value;
			}

			/**
			 * Parses a line from the new (v6.1) file format:
			 * Headers:
			 * MessNum | Time | Latitude | Longitude | GPSConfidence | PositionConfidence | MobilityProb | Drive_Session | IndoorOutdoor_Session | MeasurementReport | IndoorProb | SessionId | Controller | PrimaryCellId
			 *
			 * @param {Array} record         array of data fields
			 * @param {FileStatistics} stats A reference to statistics about the current file
			 */
			function parseAxfRecord(record, stats) {

				if (record.length < LineLengths.AXF_60) {
					logger.warn("Incomplete record #" + (stats.numResults + 1) + " - skipped.");
					return;
				}

				var confidence = columnIndex.getValueFrom(record, AXF_FIELDS.CONF),
					probMobile = columnIndex.getValueFrom(record, AXF_FIELDS.PROB_MOB),
					probIndoor = columnIndex.getValueFrom(record, AXF_FIELDS.PROB_INDOOR);

				// extended AXF file fields
				var sessionId     = columnIndex.getValueFrom(record, AXF_FIELDS.SESSIONID);
				var controllerId  = columnIndex.getValueFrom(record, AXF_FIELDS.CONTROLLER);
				var primaryCellId = columnIndex.getValueFrom(record, AXF_FIELDS.PRIM_CELL_ID);
				var refControllerId = columnIndex.getValueFrom(record, AXF_FIELDS.REF_CONTROLLER);
				var referenceCellId = columnIndex.getValueFrom(record, AXF_FIELDS.REF_CELL_ID);
				var confScalingFactor = columnIndex.getValueFrom(record, AXF_FIELDS.SCALEFACTOR);

				var sessionProperties = {
					sessionId: sessionId
				};

				var props = {
					msgId:     columnIndex.getValueFrom(record, AXF_FIELDS.MSGID),
					sessionId: sessionId,
					timestamp: columnIndex.getValueFrom(record, AXF_FIELDS.TIME),
					position: new Position(columnIndex.getValueFrom(record, AXF_FIELDS.GEO_LAT),
										   columnIndex.getValueFrom(record, AXF_FIELDS.GEO_LON)),
					driveSession: columnIndex.getValueFrom(record, AXF_FIELDS.MOBILE_YN),
					indoor:       columnIndex.getValueFrom(record, AXF_FIELDS.INDOOR_YN),
					isMeasReport: (columnIndex.getValueFrom(record, AXF_FIELDS.MEAS_REPORT) == 1),
					confidence:   percent2Decimal(confidence),
					probMobility: percent2Decimal(probMobile),
					probIndoor: percent2Decimal(probIndoor),
					controllerId: controllerId,
					primaryCellId: primaryCellId,
					refControllerId: refControllerId,
					referenceCellId: referenceCellId,
					confScalingFactor: confScalingFactor,
				};

				var session = getSession(sessionId, sessionProperties);
				session.results.add(new AxfResult(props), OPT_SILENT);

				stats.numResults++;
				stats.referenceCellsAvailable = stats.referenceCellsAvailable || !isNaN(referenceCellId);
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


			// return public API
			return {

				parse: function(targetCollection, rowData, fileType, fileStatistics) {

					if (targetCollection)
						sessionList = targetCollection;

					return processCSV(rowData, fileType, fileStatistics);
				}
			};
		})();

		return ResultFileParser;
	}
);