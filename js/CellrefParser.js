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

						//console.log("Identified columns: " + colSiteId);
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
