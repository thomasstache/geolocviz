define(
	["underscore", "backbone",
	 "collections/sectors" ],

	function(_, Backbone, SectorList) {

		var Site = Backbone.Model.extend({

			defaults: {
				// SiteID
				id: -1,
				// site name
				name: "",
				// @type {Position} geographical position
				position: null,
				// collection of sectors
				sectors: null,
				// network system/technology: GSM, WCDMA, LTE...
				technology: "",
				// netSegment of the first sector
				netSegment: null
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
			 * Returns the Sector collection
			 * @return {SectorList}
			 */
			getSectors: function() {
				return this.get("sectors");
			},

			/**
			 * Returns an array with all sectors sorted by the given attribute.
			 * @param  {String} attribute
			 * @return {Array}
			 */
			getSectorsSortedBy: function(attribute) {
				return this.getSectors().sortBy(
					function(sector) {
						return sector.get(attribute);
					}
				);
			}
		},
		{
			// known technologies
			TECH_UNKNOWN: "unknown",
			TECH_GSM: "GSM",
			TECH_WCDMA: "UMTS",
			TECH_LTE: "LTE",
		});

		return Site;
	}
);
