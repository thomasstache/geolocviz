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
				// collection of sectors
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
			 * Returns the Sector collection
			 * @param  {Object} filters   (optional) Literal with key-value pairs that must match
			 * @return {SectorList}
			 */
			getSectors: function(filters) {

				if (filters) {
					return new SectorList(this.get('sectors').where(filters));
				}
				return this.get('sectors');
			},
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
