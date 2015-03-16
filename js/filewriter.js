define(
	["collections/sessions", "collections/results",
	 "models/session", "models/axfresult"],

	function(SessionList, ResultList, Session, AxfResult) {

		var FileWriter = (function() {

			var AXFFILE_HEADER = "#Message Number,Time,Latitude,Longitude,GPS_Confidence,Data_Position_Confidence,Mobility_Probability,Drive_Session,IndoorOutdoor_Session,MeasurementReport,Indoor_Probability";
			var AXFFILE_HEADER_XT = ",SessionId,Controller,PrimaryCellId";

			/** @type {DOMString} reference to our last object URL */
			var textFile = null;

			/**
			 * Format the header for the AXF file.
			 * TODO: track and restore the original file's header (which extended columns are present).
			 */
			function writeHeader() {

				return AXFFILE_HEADER + AXFFILE_HEADER_XT + "\n";
			}

			/**
			 * Write one AXF file line for the result.
			 * @param  {AxfResult}
			 * @return {String}
			 */
			function writeResultLine(result) {

				/* Available model attributes:

					msgId: -1,
					// id of the "call" session
					sessionId: -1,

					// @type {Position} geolocated position
					position: null,
					// confidence value after the combiner
					confidence: 0.0,
					// mobile session probability as decimal
					probMobility: 0.0,
					// indoor probability as decimal
					probIndoor: 0.0,

					// time offset
					timestamp: 0,

					// @type {Boolean} if the CT message was a "measurement report", i.e. had power values
					isMeasReport: null,

					// (optional) only available in extended .axf files:
					// serving cell controller (WCDMA RNC)
					controllerId: null,
					// id of the serving cell (corresponds to "CI" or "WCDMA_CI")
					primaryCellId: null,

					// reference cell controller (WCDMA RNC)
					refControllerId: null,
					// id of the reference cell (corresponds to "CI" or "WCDMA_CI")
					referenceCellId: null,

					// just stored in case we write it back to file
					driveSession: null,
					indoor: null
				*/

				var p = result.toJSON(),
					conf_pct = toPercent(p.confidence),
					mob_pct = toPercent(p.probMobility),
					ind_pct = toPercent(p.probIndoor),
					measRpt = p.isMeasReport ? 1 : 0;

				var lat = p.position.lat.toFixed(6),
					lon = p.position.lon.toFixed(6);

				// Drive_Session = 1, MeasurementReport = 0
				var text = `${p.msgId},${p.timestamp},${lat},${lon},,${conf_pct},${mob_pct},${p.driveSession},${p.indoor},${measRpt},${ind_pct},${p.sessionId}\n`;

				return text;
			}

			/**
			 * Format decimal numbers as integer percentages.
			 * @param  {Number} value
			 * @return {Number}
			 */
			function toPercent(value) {
				return Math.round(value * 100);
			}

			/**
			 * Create a File object URL for the given text.
			 * (from http://stackoverflow.com/a/21016088/103417)
			 *
			 * @param  {String} text The file contents
			 * @return {DOMString}
			 */
			function makeTextFile(text) {

				if (!checkFileAPIs())
					return;

				var data = new Blob([text], {type: 'text/plain'});

				// If we are replacing a previously generated file we need to
				// manually revoke the object URL to avoid memory leaks.
				if (textFile !== null) {
				  window.URL.revokeObjectURL(textFile);
				}

				textFile = window.URL.createObjectURL(data);

				// returns a URL you can use as a href
				return textFile;
			}

			// Check for the object URL File API support.
			function checkFileAPIs() {
				var ok = 'URL' in window && 'createObjectURL' in URL;

				if (!ok)
					alert('The Object URL APIs are not fully supported in this browser. Consider using Mozilla Firefox (>=4) or Google Chrome (>=32)!');

				return ok;
			}

			/**
			 * Creates an AXF file containing the results in the given sessions.
			 * @param  {SessionList} sessions the list of Session models
			 * @return {DOMString}            an object URL for the file for download
			 */
			function createAxfFileAsURL(sessions) {

				var results = new ResultList();

				sessions.each(function(session) {
					results.add(session.results.models);
				});

				results.comparator = 'msgId';
				results.sort();

				var content = writeHeader();

				results.each(function(result) {
					content += writeResultLine(result);
				});

				return makeTextFile(content);
			}


			// return public API
			return {

				createAxfFileAsURL: createAxfFileAsURL
			};
		})();

		return FileWriter;
	}
);