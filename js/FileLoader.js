define(
	["underscore",
	 "collections/sessions", "collections/results", "collections/sites",
	 "models/AccuracyResult", "models/axfresult", "models/site", "jquery.csv"],

	function(_, SessionList, ResultList, SiteList, AccuracyResult, AxfResult, Site) {

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

					if (currentFileType === null) {
						alert("Could not recognize this file type!");
					}
					else {
						// comma for AXF files, TAB for rest (accuracy results and Cellrefs)
						var separator = (currentFileType === FileTypes.AXF) ? "," : "\t";

						// decompose the blob
						rowData = jQuery.csv(separator)(rdr.result);

						// parse the data
						if (currentFileType === FileTypes.CELLREF)
							bOk = processCellrefs(rowData);
						else
							bOk = processCSV(rowData, currentFileType, fileStatistics);
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

				stats.numRows = 0,
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
				stats.numRows = rowData.length - 1;

				currentAccuracyResult = null; // release
				sessionList.trigger('add');
				return true;
			}

			/**
			 * Parse the rows of a cellrefs file
			 * @param {Array} rows Array of row records
			 * @return {Boolean}   True if successful, false on error (i.e. unknown file format)
			 */
			function processCellrefs(rows) {

				var bOk = true;

				_.each(rows, function _prsRow(rowItems) {

					if (!rowItems || rowItems.length === 0)
						return;

					var lineTypeId = rowItems[0];

					if (lineTypeId.charAt(0) === ";") {
						bOk &= parseCellrefComment(rowItems);
					}
					else {
						switch(lineTypeId)
						{
							case 'GSM_Site':
							case 'WCDMA_Site':
								bOk &= parseCellrefSiteRecord(rowItems);
								break;

							case 'GSM_Cell':
							case 'WCDMA_Cell':
								bOk &= parseCellrefSectorRecord(rowItems);
								break;

							default:
								console.log("Unsupported line in file " + lineTypeId);
								bOk = false;
						}
					}
				});

				if (siteList)
					siteList.trigger('add');

				return bOk;
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
					session.results.add(currentAccuracyResult, OPT_SILENT);
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
				}, OPT_SILENT);
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
				var primaryCellId = (record.length == LineLengths.AXF_XT) ? record[IDX.CELL_ID] : -1;

				var geoLatLng = new google.maps.LatLng(parseFloat(record[IDX.GEO_LAT]),
													   parseFloat(record[IDX.GEO_LON]));

				var props = {
					msgId: record[IDX.MSGID],
					sessionId: sessionId,
					timestamp: record[IDX.TIMEOFFSET],
					latLng: geoLatLng,
					confidence: percent2Decimal(record[IDX.CONF]),
					probMobility: percent2Decimal(record[IDX.PROB_MOB]),
					probIndoor: percent2Decimal(probIndoor),
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
			 * Parses a comment line for column format from the Cellref file format:
			 * Supported Headers:
			 *  ;ElementTypeName	SiteID	Site_Name	Latitude	Longitude	ElementHandle
			 *  ;ElementTypeName	GSM_SiteIDForCell	Sector_ID	Azimuth	Beamwidth	State	MSA	EIRP	BCCH	BSIC	MCC	MNC	LAC	CI	Height	Tilt	Antenna_key	AntennaName	TCHList	GSMNeighborList	ElementHandle
			 *  ;ElementTypeName	WCDMA_SiteIDForCell	Sector_ID	Azimuth	Beamwidth	SC	WCDMA_CI	UARFCN	RNCID	ElementHandle
			 * @param {Array} record The row items split from the CSV
			 */
			function parseCellrefComment(record) {
				// we could look for the position of the attributes we need: latitude, longitude, azimuth, siteId, sectorId

				// identify the formatting lines, like ""
				if (record.length == 1) {
					// probably a real comment line, ignore
				}
				else if (record.length > 1) {
					var content = record[0].substr(1); // trim ";"

					if (typeof String.prototype.trim == "function") // native trim()
						content = content.trim();
					else
						content = $.trim(content);

					if (content.indexOf("ElementTypeName") === 0) {

						// this is a format line

						var colSiteId = -1,
							colSiteName = -1,
							colLat = -1,
							colLng = -1,
							colDbid = -1;

						for (var i = 0; i < record.length; i++) {
							switch (record[i])
							{
								case "SiteID":
									colSiteId = i;
									break;
								case "Site_Name":
									colSiteName = i;
									break;
								case "Latitude":
									colLat = i;
									break;
								case "Longitude":
									colLng = i;
									break;
								case "ElementHandle":
									colDbid = i;
									break;
							}
						}

						console.log("Identified columns: " + colSiteId);
					}
				}
			}

			/**
			 * Parses a site line from the Cellref file format
			 * Header:
			 *  ;ElementTypeName	SiteID	Site_Name	Latitude	Longitude	ElementHandle
			 *
			 * @param  {Array} record The row items split from the CSV
			 * @return {Boolean}      True if successful
			 */
			function parseCellrefSiteRecord(record) {

				// TODO: 20121016 replace with dynamic map built by parseCellrefComment()
				var IDX = Object.freeze({
					ELEMENTTYPE: 0,
					SITE_ID: 1,
					SITE_NAME: 2,
					GEO_LAT: 3,
					GEO_LON: 4,
					HANDLE: 5
				});

				var bOk = true;
				if (record.length > 1) {

					var siteId = record[IDX.SITE_ID];
					var tech = Site.TECH_UNKNOWN;
					var elementType = record[IDX.ELEMENTTYPE];
					switch (elementType) {
						case "WCDMA_Site":
							tech = Site.TECH_WCDMA;
							break;
						case "GSM_Site":
							tech = Site.TECH_GSM;
							break;
						default:
							tech = Site.TECH_UNKNOWN;
					}

					siteList.add({
						id: siteId,
						technology: tech,
						name: record[IDX.SITE_NAME],
						latLng: new google.maps.LatLng(parseFloat(record[IDX.GEO_LAT]),
													   parseFloat(record[IDX.GEO_LON]))
					}, OPT_SILENT);
				}
				return bOk;
			}

			/**
			 * Parses a sector line from the Cellref file format
			 * Headers:
			 *  ;ElementTypeName	GSM_SiteIDForCell	Sector_ID	Azimuth	Beamwidth	State	MSA	EIRP	BCCH	BSIC	MCC	MNC	LAC	CI	Height	Tilt	Antenna_key	AntennaName	TCHList	GSMNeighborList	ElementHandle
			 *  ;ElementTypeName	WCDMA_SiteIDForCell	Sector_ID	Azimuth	Beamwidth	SC	WCDMA_CI	UARFCN	RNCID	ElementHandle
			 * @param  {Array} record The row items split from the CSV
			 * @return {Boolean}      True if successful
			 */
			function parseCellrefSectorRecord(record) {

				// TODO: 20121017 replace with dynamic map built by parseCellrefComment()
				var IDX = Object.freeze({
					ELEMENTTYPE: 0,
					SITE_ID: 1,
					SECTOR_ID: 2,
					AZIMUTH: 3,
					BEAMWIDTH: 4,

					GSM_BCCH: 8,
					GSM_BSIC: 9,

					WCDMA_SC: 5,
					WCDMA_CI: 6,
					WCDMA_UARFCN: 7,
				});

				var bOk = true;
				if (record.length > 1) {

					var siteId = record[IDX.SITE_ID];

					var site = siteList.get(siteId);
					if (site) {
						var sectorId = record[IDX.SECTOR_ID];

						var props = {
							id: sectorId,
							azimuth: record[IDX.AZIMUTH],
							beamwidth: record[IDX.BEAMWIDTH],
						};

						var elementType = record[IDX.ELEMENTTYPE];
						if (elementType === "GSM_Cell") {
							props.bcch = record[IDX.GSM_BCCH];
							props.bsic = record[IDX.GSM_BSIC];
						}
						else if (elementType === "WCDMA_Cell") {
							props.scramblingCode = record[IDX.WCDMA_SC];
							props.uarfcn = record[IDX.WCDMA_UARFCN];
						}

						site.addSector(props, OPT_SILENT);
					}
					else {
						console.log("Sector references unknown site: " + siteId);
						bOk = false;
					}
				}
				return bOk;
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

					for (var i = 0, f; f = files[i]; i++) {
						this.loadFile(f);
					}
				},

				/**
				 * Parse and load a file. Supported types are *.axf, *.distances and *.txt
				 * @param {File} file The file to load
				 */
				loadFile: function(file) {

					var reader = new FileReader();
					// If we use onloadend, we need to check the readyState.
					reader.onloadend = onFileReadComplete;
					reader.file = file;

					reader.readAsBinaryString(file);
				}
			};
		})();

		return FileLoader;
	}
);
