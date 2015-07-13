define(
	["underscore",
	 "collections/sites",
	 "models/site", "types/position", "types/logger", "parsenumber", "jquery.csv"],

	function(_, SiteList, Site, Position, Logger, parseNumber) {

		/**
		 * Singleton module to parse and load data from files.
		 */
		var CellrefParser = (function() {

			// common Collection.add() options (add silently)
			var OPT_SILENT = { silent: true };

			// the column separators
			var SEP_CELLREF = "\t";

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
				HEIGHT: "Height",
				LAC: "LAC",
				CELLTYPE: "CellType",

				HANDLE: "ElementHandle",

				GSM_BCCH: "BCCH",
				GSM_BSIC: "BSIC",
				GSM_CI: "CI",

				WCDMA_SC: "SC",
				WCDMA_CI: "WCDMA_CI",
				WCDMA_UARFCN: "UARFCN",
				WCDMA_RNCID: "RNCID",

				LTE_ECI: "ECI",
				LTE_PCI: "PCI",
				LTE_EARFCN: "DL_EARFCN",
				LTE_TRKAREA: "TrackingArea",
				LTE_TAC: "TrackingAreaCode",
			});

			var SITE_FIELDS = Object.freeze({
				"SiteID": true,
				"Site_Name": true,
				"Latitude": true,
				"Longitude": true,
			});

			// Fields to import for each technology
			// (strings as they appear in the cellref files)

			// sector fields applying to all technologies
			var SECTOR_FIELDS_COMMON = Object.freeze({
				"Sector_ID": true,
				"Azimuth": true,
				"Beamwidth": true,
				"Height": true,
				"CellType": true,
				"ElementHandle": true,
			});

			// "set" of sector fields applying to GSM
			var SECTOR_FIELDS_GSM = Object.freeze(_.extend({
				"GSM_SiteIDForCell": true,
				"CI": true,
				"LAC": true,
				"BCCH": true,
				"BSIC": true,
			}, SECTOR_FIELDS_COMMON));

			// "set" of sector fields applying to WCDMA
			var SECTOR_FIELDS_WCDMA = Object.freeze(_.extend({
				"WCDMA_SiteIDForCell": true,
				"LAC": true,
				"WCDMA_CI": true,
				"RNCID": true,
				"UARFCN": true,
				"SC": true,
			}, SECTOR_FIELDS_COMMON));

			// "set" of sector fields applying to LTE
			var SECTOR_FIELDS_LTE = Object.freeze(_.extend({
				"LTE_SiteIDForCell": true,
				"PCI": true,
				"ECI": true,
				"TrackingArea": true,
				"TrackingAreaCode": true,
				"DL_EARFCN": true,
			}, SECTOR_FIELDS_COMMON));

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

			/** @type {Logger} */
			var logger = null;

			/**
			 * Parse the rows of a cellrefs file
			 * @param  {String} filecontent The text content of the file
			 * @return {Boolean}            True if successful, false on error (i.e. unknown file format)
			 */
			function processCellrefs(filecontent) {

				logger = Logger.getLogger();

				var bOk = true;

				// decompose the blob
				var rows = jQuery.csv(SEP_CELLREF)(filecontent);

				try {
					_.each(rows, function _prsRow(rowItems) {

						if (!rowItems || rowItems.length === 0)
							return;

						var lineTypeId = rowItems[0];

						if (lineTypeId.charAt(0) === ";") {
							bOk = bOk && parseCellrefComment(rowItems);
						}
						else {
							switch(lineTypeId)
							{
								case 'GSM_Site':
								case 'WCDMA_Site':
								case 'LTE_Site':
									bOk = bOk && parseCellrefSiteRecord(rowItems);
									break;

								case 'GSM_Cell':
								case 'WCDMA_Cell':
								case 'LTE_Cell':
									bOk = bOk && parseCellrefSectorRecord(rowItems);
									break;

								default:
									logger.error("Unsupported line in file: " + lineTypeId);
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
			 * @return {Boolean}     True if successful
			 */
			function parseCellrefComment(record) {

				var bOk = true;
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
					}
				}
				return bOk;
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
						case "LTE_Site":
							tech = Site.TECH_LTE;
							break;
						default:
							tech = Site.TECH_UNKNOWN;
					}

					// Note: in Analyzer cellrefs SITE_ID equals SITE_NAME.
					// We treat sites with the same name as duplicates, since sectors reference sites by name.
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
						logger.log("Missing data for site '" + strId + "', skipping.");
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

					if (siteId === undefined || siteId.length === 0) {
						logger.log("Sector '" + sectorId + "' has no site data, skipping.");
						return bOk;
					}

					var site = siteList.get(siteId);
					if (site) {

						// common properties
						var props = {
							name: sectorId,
							id: getAttr(record, SectorAttributes.HANDLE, DataTypes.INTEGER),
							azimuth: getAttr(record, SectorAttributes.AZIMUTH, DataTypes.INTEGER),
							beamwidth: getAttr(record, SectorAttributes.BEAMWIDTH, DataTypes.FLOAT),
						};

						var colCellType = attributeColumnIndex[SectorAttributes.CELLTYPE];
						props.cellType = (colCellType !== undefined && colCellType > 0) ? getAttr(record, SectorAttributes.CELLTYPE, DataTypes.INTEGER) : null;

						var colHeight = attributeColumnIndex[SectorAttributes.HEIGHT];
						props.height = (colHeight !== undefined && colHeight > 0) ? getAttr(record, SectorAttributes.HEIGHT, DataTypes.FLOAT) : null;

						// technology-dependent properties
						var elementType = getAttr(record, SectorAttributes.ELEMENTTYPE);
						switch (elementType) {
							case "GSM_Cell":
								props.bcch = getAttr(record, SectorAttributes.GSM_BCCH, DataTypes.INTEGER);
								props.bsic = getAttr(record, SectorAttributes.GSM_BSIC, DataTypes.INTEGER);

								props.technology = Site.TECH_GSM;
								props.cellIdentity = getAttr(record, SectorAttributes.GSM_CI, DataTypes.INTEGER);
								props.netSegment = getAttr(record, SectorAttributes.LAC, DataTypes.INTEGER);
								break;
							case "WCDMA_Cell":
								props.scramblingCode = getAttr(record, SectorAttributes.WCDMA_SC, DataTypes.INTEGER);
								props.uarfcn = getAttr(record, SectorAttributes.WCDMA_UARFCN, DataTypes.INTEGER);

								props.technology = Site.TECH_WCDMA;
								props.cellIdentity = getAttr(record, SectorAttributes.WCDMA_CI, DataTypes.INTEGER);
								props.netSegment = getAttr(record, SectorAttributes.WCDMA_RNCID, DataTypes.INTEGER);
								break;
							case "LTE_Cell":
								props.earfcn = getAttr(record, SectorAttributes.LTE_EARFCN, DataTypes.INTEGER);
								props.pci = getAttr(record, SectorAttributes.LTE_PCI, DataTypes.INTEGER);

								props.technology = Site.TECH_LTE;
								props.cellIdentity = getAttr(record, SectorAttributes.LTE_ECI, DataTypes.INTEGER);

								// pick between "TrackingAreaCode" and "TrackingArea", prefer the former
								var tac = 0;
								var colTAC = attributeColumnIndex[SectorAttributes.LTE_TAC];
								if (colTAC !== undefined && colTAC > 0)
									tac = getAttr(record, SectorAttributes.LTE_TAC, DataTypes.INTEGER);
								else
									tac = getAttr(record, SectorAttributes.LTE_TRKAREA, DataTypes.INTEGER);
								props.netSegment = tac;
								break;
						}

						// some datasets don't have a valid RNCID, use a default value
						if (!props.netSegment)
							props.netSegment = -1;

						site.addSector(props, OPT_SILENT);
					}
					else {
						logger.warn("Sector '" + sectorId + "' references unknown site: " + siteId);
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
					// convert to numeric if requested so
					if (type === DataTypes.FLOAT)
						val = parseNumber(val);
					else if (type === DataTypes.INTEGER)
						val = parseInt(val, 10);
				}
//>>excludeStart("debugExclude", pragmas.debugExclude);
				else {
					logger.debug("Attribute '" + attribute + "' not found in record.");
				}
//>>excludeEnd("debugExclude");
				return val;
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
				 * @param  {String}   filecontent      the text content of the file
				 * @return {Boolean}                   true if successful
				 */
				parse: function(targetCollection, filecontent) {

					if (targetCollection)
						siteList = targetCollection;

					return processCellrefs(filecontent);
				}
			};
		})();

		return CellrefParser;
	}
);
