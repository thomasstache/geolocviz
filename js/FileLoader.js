define(
	["collections/sessions", "collections/results",
	 "models/AccuracyResult", "models/axfresult", "jquery.csv"],

	function(SessionList, ResultList, AccuracyResult, AxfResult) {

		/**
		 * Singleton module to parse and load data from files.
		 */
		var FileLoader = (function() {

			var FileTypes = Object.freeze({
				ACCURACY: "accuracy",
				AXF: "axf",
			});

			// line/header lengths of the supported CSV files
			var LineLengths = Object.freeze({
				ACCURACY: 11,
				AXF: 11,
				AXF_XT: 12
			});

			// dummy session ID for records from files that don't provide it.
			var SESSION_ID_DEFAULT = 0;

			// reference to the Sessions collection
			var sessionList = null;

			var callbackFct = null;

			// reference to the accuracy result while we parse the records with the location candidates
			var currentAccuracyResult = null;

			// Handler for the loadend event of the FileReader
			function onFileLoaded(evt) {
				// evt: ProgressEvent, target is the FileReader
				var rdr = evt.target;
				var rowData = [];
				var filename = rdr.file ? rdr.file.name : "";

				if (rdr.readyState == FileReader.DONE) {

					var fileStatistics = {
						name: filename,
						numRows: 0,
						numResults: 0,
						numResultsAndCandidates: 0
					};

					// check which type of file we're dealing with
					var currentFileType = "";
					var ext = filename.substr(filename.lastIndexOf(".") + 1);
					switch (ext)
					{
						case "distances":
							currentFileType = FileTypes.ACCURACY;
							break;
						case "axf":
							currentFileType = FileTypes.AXF;
							break;
						default:
							currentFileType = null;
					}

					var separator = (currentFileType === FileTypes.ACCURACY) ? "\t" : ",";

					// decompose the blob
					rowData = jQuery.csv(separator)(rdr.result);

					// parse the data
					processCSV(rowData, currentFileType, fileStatistics);

					// notify about completion of this file (TODO: notify when whole batch is completed!)
					if (callbackFct !== null)
						callbackFct("ok", fileStatistics);
				}
				else {
					console.log("onFileLoaded: readyState not 'DONE'! (" + rdr.readyState + ")");
				}
			}

			// this function set all markers  to the map
			function processCSV(rowData, currentFileType, stats) {

				currentAccuracyResult = null;

				var parsingFct;
				// identify file format (rudimentary by no. columns)
				var header = rowData[0];

				if (currentFileType == FileTypes.ACCURACY && header.length == LineLengths.ACCURACY) {
					parsingFct = parseAccuracyRecordV3;
				}
				else if (currentFileType == FileTypes.AXF) {
					parsingFct = parseAxfRecord;
				}
				else {
					alert("I do not recognize this file format!");
					return;
				}

				for (var ct = 1; ct < rowData.length; ct++) {
					parsingFct(rowData[ct], stats);
				}
				stats.numRows = rowData.length - 1;

				currentAccuracyResult = null; // release
				sessionList.trigger('add');
			}

			/* Parses a line from the new (v6.1) file format:
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

					// reference marker location
					var refLatLng = new google.maps.LatLng(parseFloat(record[IDX.REF_LAT]),
														   parseFloat(record[IDX.REF_LON]));

					// get the session if existing
					var session = getSession(sessId);

					currentAccuracyResult = new AccuracyResult({
						msgId: msgId,
						sessionId: sessId,
						latLng: refLatLng
					});
					session.results.add(currentAccuracyResult, { silent: true });
					stats.numResults++;
				}

				var confidence = record[IDX.CONF];
				var probMobile = record[IDX.PROB_MOB];
				var probIndoor = record[IDX.PROB_INDOOR];

				var geoLatLng = new google.maps.LatLng(parseFloat(record[IDX.GEO_LAT]),
													   parseFloat(record[IDX.GEO_LON]));

				var distReported = record[IDX.DIST];

				currentAccuracyResult.locationCandidates.add({
					latLng: geoLatLng,
					distance: distReported,
					confidence: confidence,
					probMobility: probMobile,
					probIndoor: probIndoor
				}, { silent: true });
				stats.numResultsAndCandidates++;
			}

			/* Parses a line from the new (v6.1) file format:
			 * Headers:
			 * FileId | MessNum | DTLatitude | DTLongitude | CTLatitude | CTLongitude | Distance | PositionConfidence | MobilityProb | IndoorProb | SessionId
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
					PROB_INDOOR: 10,
					SESSIONID: 11
				});

				function percent2Decimal(value) {
					var parsedVal = parseInt(value);
					if (typeof parsedVal === "number")
						value = parsedVal / 100.0;
					return value;
				}

				var msgId = record[IDX.MSGID];
				var timestamp = record[IDX.TIMEOFFSET];
				var confidence = percent2Decimal(record[IDX.CONF]);
				var probMobile = percent2Decimal(record[IDX.PROB_MOB]);
				var probIndoor = percent2Decimal(record[IDX.PROB_INDOOR]);

				// assume we don't have a session id
				var sessionId = (record.length == LineLengths.AXF_XT) ? record[IDX.SESSIONID]
																	  : SESSION_ID_DEFAULT;

				var geoLatLng = new google.maps.LatLng(parseFloat(record[IDX.GEO_LAT]),
													   parseFloat(record[IDX.GEO_LON]));

				var props = {
					msgId: msgId,
					sessionId: sessionId,
					timestamp: timestamp,
					latLng: geoLatLng,
					confidence: confidence,
					probMobility: probMobile,
					probIndoor: probIndoor
				};

				var session = getSession(sessionId);
				session.results.add(new AxfResult(props), { silent: true });
				stats.numResults++;
			}

			function getSession(sessId) {

				// get the session if existing
				var session = sessionList.get(sessId);
				if (!session) {
					// create missing session
					sessionList.add({
						id: sessId
					}, { silent: true });

					session = sessionList.at(sessionList.length - 1);
				}
				return session;
			}

			// return the external API
			return {

				/**
				 * Load all files in the array. Supported types are .axf and .distances
				 * @param files     Array of File objects (e.g. as retrieved from a input[type="file"]).
				 * @param callback  Callback function to call when done.
				 */
				loadFiles: function(files, sessions, callback) {

					if (sessions)
						sessionList = sessions;

					if (typeof callback === "function")
						callbackFct = callback;

					for (var i = 0, f; f = files[i]; i++) {
						this.loadFile(f);
					}
				},

				/**
				 * Parse and load a file. Supported types are .axf and .distances
				 */
				loadFile: function(file) {

					var reader = new FileReader();
					// If we use onloadend, we need to check the readyState.
					reader.onloadend = onFileLoaded;
					reader.file = file;

					reader.readAsBinaryString(file);
				}
			};
		})();

		return FileLoader;
	}
);
