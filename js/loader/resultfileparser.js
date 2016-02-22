define(
	["collections/sessions", "collections/results",
	 "models/session", "models/AccuracyResult", "models/axfresult",
	 "types/position", "types/filestatistics", "types/filetypes",
	 "types/csvfield", "loader/csvcolumnindex",
	 "types/logger", "jquery.csv"],

	function(SessionList, ResultList, Session, AccuracyResult, AxfResult,
			 Position, FileStatistics, FileTypes, CSVField, CSVColumnIndex, Logger) {

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

			// the column separators
			var SEP_AXF = ",",
				SEP_ACCURACY = "\t";

			// definition of supported fields
			var AXF_FIELDS = Object.freeze({
				MSGID:          new CSVField("Message Number",                   CSVField.TYPE_INTEGER, { required: true }),
				TIME:           new CSVField("Time",                             CSVField.TYPE_INTEGER, { required: true }),
				GEO_LAT:        new CSVField("Latitude",                         CSVField.TYPE_FLOAT, { required: true }),
				GEO_LON:        new CSVField("Longitude",                        CSVField.TYPE_FLOAT, { required: true }),
				GPS_CONF:       new CSVField("GPS_Confidence",                   CSVField.TYPE_STRING),
				CONF:           new CSVField("Data_Position_Confidence",         CSVField.TYPE_INTEGER, { required: true }),
				PROB_MOB:       new CSVField("Mobility_Probability",             CSVField.TYPE_INTEGER, { required: true }),
				MOBILE_YN:      new CSVField("Drive_Session",                    CSVField.TYPE_STRING),
				INDOOR_YN:      new CSVField("IndoorOutdoor_Session",            CSVField.TYPE_STRING),
				MEAS_REPORT:    new CSVField("MeasurementReport",                CSVField.TYPE_INTEGER),
				PROB_INDOOR:    new CSVField("Indoor_Probability",               CSVField.TYPE_INTEGER, { required: true }),// 6.1+
				IMSI:           new CSVField("MsIMSI",                           CSVField.TYPE_STRING),// 7.4+, LTE only
				// XT
				SESSIONID:      new CSVField("SessionId",                        CSVField.TYPE_STRING,  { defaultValue: Session.ID_DUMMY }),// intentionally as String, as it gets very long
				CONTROLLER:     new CSVField("Controller",                       CSVField.TYPE_INTEGER, { defaultValue: NaN }),
				PRIM_CELL_ID:   new CSVField("PrimaryCellId",                    CSVField.TYPE_INTEGER, { defaultValue: NaN }),
				// XT2
				REF_CONTROLLER: new CSVField("ReferenceController",              CSVField.TYPE_INTEGER, { defaultValue: NaN }),
				REF_CELL_ID:    new CSVField("ReferenceCellId",                  CSVField.TYPE_INTEGER, { defaultValue: NaN }),
				SCALEFACTOR:    new CSVField("ConfidenceThresholdScalingFactor", CSVField.TYPE_STRING, null),
			});

			var ACCURACY_FIELDS = Object.freeze({
				FILEID:       new CSVField("FileId",                           CSVField.TYPE_STRING, { required: true }),
				MSGID:        new CSVField("MessNum",                          CSVField.TYPE_INTEGER, { required: true }),
				REF_LAT:      new CSVField("DTLatitude",                       CSVField.TYPE_FLOAT, { required: true }),
				REF_LON:      new CSVField("DTLongitude",                      CSVField.TYPE_FLOAT, { required: true }),
				GEO_LAT:      new CSVField("CTLatitude",                       CSVField.TYPE_FLOAT, { required: true }),
				GEO_LON:      new CSVField("CTLongitude",                      CSVField.TYPE_FLOAT, { required: true }),
				DIST:         new CSVField("Distance",                         CSVField.TYPE_FLOAT, { required: true }),
				CONF:         new CSVField("PositionConfidence",               CSVField.TYPE_FLOAT),
				PROB_MOB:     new CSVField("MobilityProbability",              CSVField.TYPE_FLOAT),
				PROB_INDOOR:  new CSVField("IndoorProbability",                CSVField.TYPE_FLOAT),
				SESSIONID:    new CSVField("SessionId",                        CSVField.TYPE_STRING, { defaultValue: Session.ID_DUMMY }),
				CONTROLLER:   new CSVField("Controller",                       CSVField.TYPE_INTEGER, { defaultValue: NaN }),// 6.1.2+
				PRIM_CELL_ID: new CSVField("PrimaryCellId",                    CSVField.TYPE_INTEGER, { defaultValue: NaN }),// 6.1.2+
				TIME:         new CSVField("Time",                             CSVField.TYPE_INTEGER, { defaultValue: NaN }),// 6.4+
				SCALEFACTOR:  new CSVField("ConfidenceThresholdScalingFactor", CSVField.TYPE_STRING, { defaultValue: null }),// ?
			});

			/** @type {SessionList} reference to the Sessions collection */
			var sessionList = null;

			/** @type {CSVColumnIndex} indexer managing extracting result attributes from the row data */
			var columnIndex = null;

			// we check the msgId of accuracy results to suppress duplicate records in old files with location candidates
			var currentAccuracyResultID = -1;

			/** @type {Logger} */
			var logger = null;

			/**
			 * Parse the array of rows from the file
			 * @param  {String} filecontent     The text content of the file
			 * @param  {String} currentFileType see FileTypes
			 * @param  {FileStatistics} stats   reference to statistics about the current file
			 * @return {Boolean} true if successful, false on error (i.e. unknown file format)
			 */
			function processResultFile(filecontent, currentFileType, stats) {

				logger = Logger.getLogger();

				currentAccuracyResultID = -1;

				stats.numResults = 0;

				// comma for AXF files, TAB for accuracy results
				var separator = (currentFileType === FileTypes.AXF) ? SEP_AXF : SEP_ACCURACY;

				// decompose the blob
				var rowData = jQuery.csv(separator)(filecontent);

				columnIndex = new CSVColumnIndex(separator);

				var parsingFct = null,
					isValid = false;

				var header = rowData[0];

				if (currentFileType == FileTypes.ACCURACY &&
					header.length >= LineLengths.ACCURACY_61) {

					parsingFct = parseAccuracyRecord;
					isValid = columnIndex.prepareForHeader(header, ACCURACY_FIELDS);
				}
				else if (currentFileType == FileTypes.AXF &&
						 header.length >= LineLengths.AXF_60) {

					parsingFct = parseAxfRecord;
					isValid = columnIndex.prepareForHeader(header, AXF_FIELDS);
				}
				else if (currentFileType == FileTypes.ACCURACY &&
						 header.length == LineLengths.ACCURACY_60) {
					alert("'Geotagging 1' accuracy results are not supported!");
					return false;
				}

				if (!isValid) {
					return false;
				}

				if (!parsingFct) {
					alert("Could not recognize this file's CSV format!");
					return false;
				}

				for (var ct = 1; ct < rowData.length; ct++) {
					parsingFct(rowData[ct], stats);
				}

				columnIndex = null;

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
			function parseAccuracyRecord(record, stats) {

				if (record.length < LineLengths.ACCURACY_61) {
					logger.warn("Incomplete accuracy record #" + (stats.numResults + 1) + " - skipped.");
					return;
				}

				var fileId    = columnIndex.getValueFrom(record, ACCURACY_FIELDS.FILEID),
					msgId     = columnIndex.getValueFrom(record, ACCURACY_FIELDS.MSGID),
					timestamp = columnIndex.getValueFrom(record, ACCURACY_FIELDS.TIME);

				// suppress records with repeating msgId (location candidates for the same sample)
				if (msgId == currentAccuracyResultID)
					return;

				currentAccuracyResultID = msgId;

				var sessionId = columnIndex.getValueFrom(record, ACCURACY_FIELDS.SESSIONID);

				// get the session if existing
				var session = getSession(fileId, sessionId);

				var props = {
					msgId: msgId,
					timestamp: timestamp,
					sessionId: session.get("id"),
					refPosition: new Position(columnIndex.getValueFrom(record, ACCURACY_FIELDS.REF_LAT),
											  columnIndex.getValueFrom(record, ACCURACY_FIELDS.REF_LON)),
					position: new Position(columnIndex.getValueFrom(record, ACCURACY_FIELDS.GEO_LAT),
										   columnIndex.getValueFrom(record, ACCURACY_FIELDS.GEO_LON)),
					distance:     columnIndex.getValueFrom(record, ACCURACY_FIELDS.DIST),
					confidence:   columnIndex.getValueFrom(record, ACCURACY_FIELDS.CONF),
					probMobility: columnIndex.getValueFrom(record, ACCURACY_FIELDS.PROB_MOB),
					probIndoor:   columnIndex.getValueFrom(record, ACCURACY_FIELDS.PROB_INDOOR),
					controllerId: columnIndex.getValueFrom(record, ACCURACY_FIELDS.CONTROLLER),
					primaryCellId: columnIndex.getValueFrom(record, ACCURACY_FIELDS.PRIM_CELL_ID)
				};

				session.results.add(new AccuracyResult(props), OPT_SILENT);
				stats.numResults++;
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

				var fileId = stats.name;

				var session = getSession(fileId, sessionId);

				var props = {
					msgId:     columnIndex.getValueFrom(record, AXF_FIELDS.MSGID),
					sessionId: session.get("id"),
					timestamp: columnIndex.getValueFrom(record, AXF_FIELDS.TIME),
					position: new Position(columnIndex.getValueFrom(record, AXF_FIELDS.GEO_LAT),
										   columnIndex.getValueFrom(record, AXF_FIELDS.GEO_LON)),
					driveSession: columnIndex.getValueFrom(record, AXF_FIELDS.MOBILE_YN),
					indoor:       columnIndex.getValueFrom(record, AXF_FIELDS.INDOOR_YN),
					isMeasReport: (columnIndex.getValueFrom(record, AXF_FIELDS.MEAS_REPORT) == 1),
					confidence:   percent2Decimal(confidence),
					probMobility: percent2Decimal(probMobile),
					probIndoor:   percent2Decimal(probIndoor),
					controllerId:  controllerId,
					primaryCellId: primaryCellId,
					refControllerId: refControllerId,
					referenceCellId: referenceCellId,
					confScalingFactor: confScalingFactor,
				};

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
			 * @param  {String} fileId       the calltrace file name
			 * @param  {String} sessionId    Id of the session
			 * @return {Session}
			 */
			function getSession(fileId, sessionId) {

				// the same SessionId can appear in multiple calltrace files, make unique.
				var sessionUId = makeSessionUId(fileId, sessionId);

				// get the session if existing
				var session = sessionList.get(sessionUId);
				if (!session) {
					// create missing session
					sessionList.add({
						id: sessionUId,
						sessionId: sessionId,
						fileId: fileId
					}, OPT_SILENT);

					session = sessionList.at(sessionList.length - 1);
				}
				return session;
			}


			// return public API
			return {

				/**
				 * Parse the file content from a result file
				 * @param  {SessionList} targetCollection the site collection
				 * @param  {String}      filecontent      the text content of the file
				 * @param  {String}      currentFileType  see FileTypes
				 * @param  {FileStatistics} stats         reference to statistics about the current file
				 * @return {Boolean}                      true if successful
				 */
				parse: function(targetCollection, filecontent, fileType, fileStatistics) {

					if (targetCollection)
						sessionList = targetCollection;

					return processResultFile(filecontent, fileType, fileStatistics);
				}
			};
		})();

		return ResultFileParser;
	}
);