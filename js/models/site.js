define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Site = Backbone.Model.extend({

			// known technologies
			TECH_UNKNOWN: "unknown",
			TECH_GSM: "gsm",
			TECH_UMTS: "wcdma",

			defaults: {
				// SiteID
				id: -1,
				// site name
				name: "",
				// geographical position
				latLng: null,
				// array of cells
				cells: null,

				technology: ""
			},

			initialize: function() {
				if (!this.get("technology"))
					this.set("technology", Site.TECH_UNKNOWN);
				this.set("cells", []);
			},
		});

		return Site;
	}
);
