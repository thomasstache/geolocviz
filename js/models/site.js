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
				// geographical position
				latLng: null,
				// collection of sectors
				sectors: null,
				// network system/technology: GSM, WCDMA, LTE...
				technology: ""
			},

			initialize: function() {
				if (!this.get("technology"))
					this.set("technology", Site.TECH_UNKNOWN);

				this.set("sectors", new SectorList());
			},

			/**
			 * Add a sector to the site
			 * @param {Sector} sector the new sector (can also be an attribute hash, will be passed to Backbone.Collection.add().)
			 */
			addSector: function(sector, addOptions) {
				this.get("sectors").add(sector, addOptions);
			},

			/**
			 * Returns the Sector collection
			 * @return {SectorList}
			 */
			getSectors: function() {
				return this.get("sectors");
			}
		},
		{
			// known technologies
			TECH_UNKNOWN: "unknown",
			TECH_GSM: "gsm",
			TECH_WCDMA: "wcdma",
		});

		return Site;
	}
);
