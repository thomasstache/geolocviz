define(
	["collections/sessions", "collections/results",
	 "models/session", "models/axfresult"],

	function(SessionList, ResultList, Session, AxfResult) {

		var FileWriter = (function() {

			var AXFFILE_HEADER = "#Message Number,Time,Latitude,Longitude,GPS_Confidence,Data_Position_Confidence,Mobility_Probability,Drive_Session,IndoorOutdoor_Session,MeasurementReport,Indoor_Probability";
			var AXFFILE_HEADER_XT = ",SessionId,Controller,PrimaryCellId,ReferenceController,ReferenceCellId,ConfidenceThresholdScalingFactor";

			// TODO: make configurable
			var extendedAxf = true;

			/**
			 * Format the header for the AXF file.
			 * TODO: track and restore the original file's header (which extended columns are present).
			 */
			function writeHeader() {

				return AXFFILE_HEADER + (extendedAxf ? AXFFILE_HEADER_XT : "") + "\n";
			}

			/**
			 * Write one AXF file line for the result.
			 * @param  {AxfResult}
			 * @return {String}
			 */
			function writeResultLine(result) {
				/* jshint unused:false, esnext:true */

				/* Available model attributes:

					msgId: -1,
					sessionId: -1,
					position: null,
					confidence: 0.0,
					probMobility: 0.0,
					probIndoor: 0.0,
					timestamp: 0,
					isMeasReport: null,
					controllerId: null,
					primaryCellId: null,
					refControllerId: null,
					referenceCellId: null,
					driveSession: null,
					indoor: null,
					confScalingFactor: null,
				*/

				var p = result.toJSON(),
					conf_pct = toPercent(p.confidence),
					mob_pct = toPercent(p.probMobility),
					ind_pct = toPercent(p.probIndoor),
					measRpt = p.isMeasReport ? 1 : 0;

				var lat = p.position.lat.toFixed(6),
					lon = p.position.lon.toFixed(6);

				// data from extended AXF files
				var extension = "";
				if (extendedAxf) {
					var refControllerId = p.refControllerId || "",
						referenceCellId = p.referenceCellId || "",
						confScalingFactor = p.confScalingFactor || "";

					// extension = `,${p.sessionId},${p.controllerId},${p.primaryCellId},${refControllerId},${referenceCellId},${confScalingFactor}`;
					extension = "," + p.sessionId + "," + p.controllerId + "," + p.primaryCellId + "," + refControllerId + "," + referenceCellId + "," + confScalingFactor;
				}

				/**
				 * TODO: Don't use ES6 template strings yet, as r.js can't parse/optimize them.
				 */
				// var text = `${p.msgId},${p.timestamp},${lat},${lon},,${conf_pct},${mob_pct},${p.driveSession},${p.indoor},${measRpt},${ind_pct}${extension}\n`;
				var text =  p.msgId + "," + p.timestamp + "," + lat + "," + lon + ",," + conf_pct + "," + mob_pct + "," + p.driveSession + "," + p.indoor + "," + measRpt + "," + ind_pct + extension + "\n";

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
				var textFile = window.URL.createObjectURL(data);

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