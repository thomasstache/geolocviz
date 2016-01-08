define(
	["underscore", "backbone",
	 "collections/sectors" ],

	function(_, Backbone, SectorList) {

		var Site = Backbone.Model.extend({

			defaults: {
				// SiteID
				id: "",
				// site name
				name: "",
				// @type {Position} geographical position
				position: null,
				// @type {SectorList} collection of sectors
				sectors: null,
				// network system/technology: GSM, WCDMA, LTE...
				technology: "",
				// netSegment of the first sector
				netSegment: null
			},

			constructor: function Site() {
				Backbone.Model.prototype.constructor.apply(this, arguments);
			},

			initialize: function() {
				if (!this.get("technology"))
					this.set("technology", Site.TECH_UNKNOWN);

				this.set("sectors", new SectorList());
			},

			getInfo: function() {
				var info = this.toJSON();
				info.sectors = this.getSectors().map(function(sector){ return sector.toJSON();});
				return info;
			},

			/**
			 * Add a sector to the site
			 * @param {Sector} sector the new sector (can also be an attribute hash, will be passed to Backbone.Collection.add().)
			 */
			addSector: function(sector, addOptions) {
				this.get("sectors").add(sector, addOptions);

				if (!this.has('netSegment')) {

					var netSegment = (sector instanceof Backbone.Model) ? sector.get('netSegment')
																		: sector.netSegment;
					this.set('netSegment', netSegment);
				}
			},

			/**
			 * Returns the Sector collection, optionally filtered by given attribute values.
			 * @param  {Object} filters   (optional) Literal with key-value pairs that must match. Or an array of such literals.
			 *  Examples:
			 *    { cellIdentity: sectorProps.primaryCellId, netSegment: sectorProps.controllerId }
			 *    [{ channelNumber: 123 }, { channelNumber: 456 }, { channelNumber: 789 }]
			 * @return {SectorList}
			 */
			getSectors: function(filters) {

				var allSectors = this.get('sectors');

				if (filters) {

					var matchingSectors = [];
					if (filters instanceof Array) {

						filters.forEach(function addMatchesForFilter(filter) {
							matchingSectors = matchingSectors.concat(allSectors.where(filter));
						});
					}
					else {
						matchingSectors = allSectors.where(filters);
					}

					return new SectorList(matchingSectors);
				}
				return allSectors;
			},
		}, {
			// known technologies
			TECH_UNKNOWN: "unknown",
			TECH_GSM: "GSM",
			TECH_WCDMA: "UMTS",
			TECH_LTE: "LTE",
		});

		return Site;
	}
);
