define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Sector = Backbone.Model.extend({

			defaults: {
				// SectorID
				id: -1,
				// antenna azimuth in RAD
				azimuth: 0.0,
				// antenna beamwidth
				beamwidth: 0.0,

				// cell identity, (WCDMA: "WCDMA_CI", GSM: "CI")
				cellIdentity: null,
				// controller ID (WCDMA: "RNCID", GSM: ???)
				controllerId: null,

				// GSM sector attributes
				bcch: -1,
				bsic: -1,

				// WCDMA sector attributes
				scramblingCode: -1,
				uarfcn: -1,
			},

			initialize: function() {
			},

			getTooltipText: function() {
				var s = this.get('id') + " (";

				if (this.get('bcch') > -1)
					s += "BCCH: " + this.get('bcch') + ",";
				if (this.get('uarfcn') > -1)
					s += "UARFCN: " + this.get('uarfcn') + ",";

				s += this.get('azimuth') + "d)";
				return s;
			}
		});

		return Sector;
	}
);
