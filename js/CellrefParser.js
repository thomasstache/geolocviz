define(
	["underscore",
	 "collections/sites",
	 "models/site"],

	function(_, SiteList, Site) {

		/**
		 * Singleton module to parse and load data from files.
		 */
		var CellrefParser = (function() {

			// common Collection.add() options (add silently)
			var OPT_SILENT = Object.freeze({ silent: true });

			var SITE_FIELDS = Object.freeze({
				"SiteID": true,
				"Site_Name": true,
				"Latitude": true,
				"Longitude": true,
			});

			var SECTOR_FIELDS_GSM = Object.freeze({
				"GSM_SiteIDForCell": true,
				"Sector_ID": true,
				"Azimuth": true,
				"Beamwidth": true,
				"CI": true,
				"LAC": true,
				"BCCH": true,
				"BSIC": true,
			});

			var SECTOR_FIELDS_WCDMA = Object.freeze({
				"WCDMA_SiteIDForCell": true,
				"Sector_ID": true,
				"Azimuth": true,
				"Beamwidth": true,
				"WCDMA_CI": true,
				"RNCID": true,
				"SC": true,
			});

			// TODO: 20121106 TBD!!!
			var SECTOR_FIELDS_LTE = Object.freeze({
				//"LTE_SiteIDForCell": true,
			});

			/** @type {Object} map of attributes to column indices in the current "format block" */
			var attributeColumnIndex = {};

			/** @type {SiteList} reference to the Sites collection */
			var siteList = null;

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

					var firstField = record[0].substr(1); // trim leading ";"
					firstField = trimString(firstField);

					if (firstField.indexOf("ElementTypeName") === 0) {

						// this is a format line

						// reset our column index
						attributeColumnIndex = {};
						// always need the ElementTypeName
						attributeColumnIndex[firstField] = 0;

						// emulate a set using object literal, so we can do
						//   if (key in set)...
						var requiredFields = {};

						// just for logging purposes
						var mode = "";

						// site or sector? which technology? Check field name in 2nd column:
						// sites:
						//   SiteID
						// sectors:
						//   GSM_SiteIDForCell
						//   WCDMA_SiteIDForCell
						//   CDMA_SiteIDForCell
						//   CDMA1xEVDO_SiteIDForCell
						//   LTE_SiteIDForCell

						var secondField = trimString(record[1]);
						switch (secondField) {

							// site attribute columns
							case "SiteID":
								// required attributes: "SiteID", "Site_Name", "Latitude", "Longitude"
								requiredFields = SITE_FIELDS;
								mode = "sites";
								break;

							// GSM sector attributes
							case "GSM_SiteIDForCell":
								// required attributes: "SiteIDForCell", "Sector_ID", "Azimuth", "Beamwidth" , "CI", "LAC", "BCCH", "BSIC"
								requiredFields = SECTOR_FIELDS_GSM;
								mode = "GSM sectors";
								break;

							// UMTS sector attributes
							case "WCDMA_SiteIDForCell":
								// required attributes: "SiteIDForCell", "Sector_ID", "Azimuth", "Beamwidth" , "WCDMA_CI", "RNCID", "SC"
								requiredFields = SECTOR_FIELDS_WCDMA;
								mode = "WCDMA sectors";
								break;

							case "LTE_SiteIDForCell":
								requiredFields = SECTOR_FIELDS_LTE;
								mode = "LTE sectors";
								break;
						}

						for (var i = 0; i < record.length; i++) {

							var field = trimString(record[i]);

							if (field in requiredFields) {
								// override key for site reference to be the same for all technologies
								if (field === secondField)
									field = "SiteIDForCell";
								attributeColumnIndex[field] = i;
							}
						}

						if (_.keys(attributeColumnIndex).length > 1) {
							//console.log("%c Identified columns (" + mode + "):", "background-color: #BFE3E2;"); // with color for new Chrome Devtools
							console.log("Identified columns (" + mode + "):");
							console.log(attributeColumnIndex);
						}
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
						latLng: new google.maps.LatLng(parseNumber(record[IDX.GEO_LAT]),
													   parseNumber(record[IDX.GEO_LON]))
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
					GSM_CI: 13,

					WCDMA_SC: 5,
					WCDMA_CI: 6,
					WCDMA_UARFCN: 7,
					WCDMA_RNCID: 8,
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
							props.cellIdentity = record[IDX.GSM_CI];
						}
						else if (elementType === "WCDMA_Cell") {
							props.scramblingCode = record[IDX.WCDMA_SC];
							props.uarfcn = record[IDX.WCDMA_UARFCN];

							props.cellIdentity = record[IDX.WCDMA_CI];
							props.controllerId = record[IDX.WCDMA_RNCID];
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

			/**
			 * Helper function to validate and convert numeric values.
			 */
			function parseNumber(text) {
				if (text.indexOf(",") > 0)
					text = text.replace(",", ".");

				return parseFloat(text);
			}

			/**
			 * Helper function to trim strings.
			 * @param  {String} text
			 * @return {String}
			 */
			function trimString(text) {

				var rv;
				if (typeof String.prototype.trim == "function") // native trim()
					rv = text.trim();
				else
					rv = $.trim(text);

				return rv;
			}

			// return the external API
			return {

				/**
				 * Parse the row data from a cellref file
				 * @param  {SiteList} targetCollection the site collection
				 * @param  {Array}    rowdata          Array of row records
				 * @return {Boolean}                   true if successful
				 */
				parse: function(targetCollection, rowdata) {

					if (targetCollection)
						siteList = targetCollection;

					return processCellrefs(rowdata);
				}
			};
		})();

		return CellrefParser;
	}
);
