define(
	["underscore",
	 "collections/sites",
	 "models/site", "models/position"],

	function(_, SiteList, Site, Position) {

		/**
		 * Singleton module to parse and load data from files.
		 */
		var CellrefParser = (function() {

			// common Collection.add() options (add silently)
			var OPT_SILENT = Object.freeze({ silent: true });

			//////////////////////////////////////////////////////////////////////////
			// Definition of required fields for the various element types:

			// definition of site attribute keys
			var SiteAttributes = Object.freeze({
				ELEMENTTYPE: "ElementTypeName",
				SITE_ID: "SiteID",
				SITE_NAME: "Site_Name",
				GEO_LAT: "Latitude",
				GEO_LON: "Longitude",
			});

			// definition of sector attribute keys
			var SectorAttributes = Object.freeze({
				ELEMENTTYPE: "ElementTypeName",
				// internal normalized tech-independent version:
				SITE_ID: "SiteIDForCell",
				SECTOR_ID: "Sector_ID",
				AZIMUTH: "Azimuth",
				BEAMWIDTH: "Beamwidth",
				LAC: "LAC",

				GSM_BCCH: "BCCH",
				GSM_BSIC: "BSIC",
				GSM_CI: "CI",

				WCDMA_SC: "SC",
				WCDMA_CI: "WCDMA_CI",
				WCDMA_UARFCN: "UARFCN",
				WCDMA_RNCID: "RNCID",
			});

			var SITE_FIELDS = Object.freeze({
				"SiteID": true,
				"Site_Name": true,
				"Latitude": true,
				"Longitude": true,
			});

			// "set" of sector fields applying to GSM (strings as they appear in the cellref files)
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

			// "set" of sector fields applying to WCDMA (strings as they appear in the cellref files)
			var SECTOR_FIELDS_WCDMA = Object.freeze({
				"WCDMA_SiteIDForCell": true,
				"Sector_ID": true,
				"Azimuth": true,
				"Beamwidth": true,
				"LAC": true,
				"WCDMA_CI": true,
				"RNCID": true,
				"UARFCN": true,
				"SC": true,
			});

			// "set" of sector fields applying to LTE (strings as they appear in the cellref files)
			// TODO: 20121106 TBD!!!
			var SECTOR_FIELDS_LTE = Object.freeze({
				//"LTE_SiteIDForCell": true,
			});

			//////////////////////////////////////////////////////////////////////////

			var DataTypes = Object.freeze({
				STRING: "string",
				FLOAT: "float",
				INTEGER: "int",
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

				try {
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
									console.log("Unsupported line in file: " + lineTypeId);
									bOk = false;
							}
						}
					});
				} // no catch here, but in caller
				finally {
					if (siteList)
						siteList.trigger('add');
				}

				return bOk;
			}

			/**
			 * Parses a comment line to determine the column indices from the Cellref file format.
			 * @param {Array} record The row items split from the CSV
			 */
			function parseCellrefComment(record) {

				// identify the formatting lines, like ";ElementTypeName	SiteID	..."
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
								// override key for sectors' site reference to be the same for all technologies
								if (mode !== "sites" && field === secondField)
									field = SectorAttributes.SITE_ID;
								attributeColumnIndex[field] = i;
							}
						}

/*						if (_.keys(attributeColumnIndex).length > 1) {
							//console.log("%c Identified columns (" + mode + "):", "background-color: #BFE3E2;"); // with color for new Chrome Devtools
							console.log("Identified columns (" + mode + "):");
							console.log(attributeColumnIndex);
						}
*/					}
				}
			}

			/**
			 * Parses a site line from the Cellref file format
			 * @param  {Array} record The row items split from the CSV
			 * @return {Boolean}      True if successful
			 */
			function parseCellrefSiteRecord(record) {

				var bOk = true;
				if (record.length > 1) {

					var tech = Site.TECH_UNKNOWN;
					var elementType = getAttr(record, SiteAttributes.ELEMENTTYPE);
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

					var strId = getAttr(record, SiteAttributes.SITE_ID),
						strName = getAttr(record, SiteAttributes.SITE_NAME),
						strLat = getAttr(record, SiteAttributes.GEO_LAT),
						strLon = getAttr(record, SiteAttributes.GEO_LON);

					if (strName && strId && strLon && strLat) {

						var props = {
							id: strId,
							technology: tech,
							name: strName,
							position: new Position(parseNumber(strLat),
												   parseNumber(strLon))
						};
						siteList.add(props, OPT_SILENT);
					}
					else {
						console.log("Missing data for site, skipping: " + strId);
					}
				}
				return bOk;
			}

			/**
			 * Parses a sector line from the Cellref file format
			 * @param  {Array} record The row items split from the CSV
			 * @return {Boolean}      True if successful, false if e.g. site is unknown
			 */
			function parseCellrefSectorRecord(record) {

				var bOk = true;
				if (record.length > 1) {

					var siteId = getAttr(record, SectorAttributes.SITE_ID);
					var sectorId = getAttr(record, SectorAttributes.SECTOR_ID);

					var site = siteList.get(siteId);
					if (site) {

						// common properties
						var props = {
							id: sectorId,
							azimuth: getAttr(record, SectorAttributes.AZIMUTH, DataTypes.INTEGER),
							beamwidth: getAttr(record, SectorAttributes.BEAMWIDTH, DataTypes.FLOAT),
						};

						// technology-dependent properties
						var elementType = getAttr(record, SectorAttributes.ELEMENTTYPE);
						switch (elementType) {
							case "GSM_Cell":
								props.bcch = getAttr(record, SectorAttributes.GSM_BCCH, DataTypes.INTEGER);
								props.bsic = getAttr(record, SectorAttributes.GSM_BSIC, DataTypes.INTEGER);

								props.cellIdentity = getAttr(record, SectorAttributes.GSM_CI, DataTypes.INTEGER);
								props.netSegment = getAttr(record, SectorAttributes.LAC, DataTypes.INTEGER);
								break;
							case "WCDMA_Cell":
								props.scramblingCode = getAttr(record, SectorAttributes.WCDMA_SC, DataTypes.INTEGER);
								props.uarfcn = getAttr(record, SectorAttributes.WCDMA_UARFCN, DataTypes.INTEGER);

								props.cellIdentity = getAttr(record, SectorAttributes.WCDMA_CI, DataTypes.INTEGER);
								props.netSegment = getAttr(record, SectorAttributes.WCDMA_RNCID, DataTypes.INTEGER);
								break;
						}

						// some datasets don't have a valid RNCID, use a default value
						if (!props.netSegment)
							props.netSegment = -1;

						site.addSector(props, OPT_SILENT);
					}
					else {
						console.log("Sector '" + sectorId + "' references unknown site: " + siteId);
						bOk = false;
					}
				}
				return bOk;
			}

			/**
			 * Helper function for picking an attribute value from "record" array.
			 * @param  {Array} record             The row items split from the CSV
			 * @param  {SiteAttributes} attribute Key of the attribute to retrieve
			 * @param  {DataTypes} dataType       The data type to return ()
			 * @return {Object}                   The attribute value
			 */
			function getAttr(record, attribute, dataType) {

				var val;
				var type = dataType || DataTypes.STRING;
				var colIndex = attributeColumnIndex[attribute];

				if (colIndex !== undefined &&
					colIndex >= 0 && colIndex < record.length) {

					val = record[colIndex];
					if (type === DataTypes.FLOAT)
						val = parseNumber(val);
					else if (type === DataTypes.INTEGER)
						val = parseInt(val, 10);
				}
				else {
					console.log("Attribute '" + attribute + "' not found in record.");
				}
				return val;
			}

			/**
			 * Helper function to validate and convert numeric values.
			 * @param  {String} text
			 * @return {Number}
			 */
			function parseNumber(text) {
				if (text === undefined)
					return NaN;

				if (typeof text === "string" && text.indexOf(",") > 0)
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
