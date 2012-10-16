define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Site = Backbone.Model.extend({

			defaults: {
				// SiteID
				id: -1,
				// site name
				name: "",
				// geographical position
				latLng: null,
				// array of cells
				cells: null,
				// network system/technology: GSM, WCDMA, LTE...
				technology: ""
			},

			initialize: function() {
				if (!this.get("technology"))
					this.set("technology", Site.TECH_UNKNOWN);
				this.set("cells", []);
			},
		},
		{
			// known technologies
			TECH_UNKNOWN: "unknown",
			TECH_GSM: "gsm",
			TECH_UMTS: "wcdma",
		});

		return Site;
	}
);
