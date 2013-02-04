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
				// "network segment" in which the cellIdentity is valid (WCDMA: "RNCID", GSM: "LAC")
				netSegment: null,

				// GSM sector attributes
				bcch: null,
				bsic: null,

				// WCDMA sector attributes
				scramblingCode: null,
				uarfcn: null,
			},

			initialize: function() {
			},

			getTooltipText: function() {
				var s = this.get('id') + " (";

				s += "CI: " + this.get('cellIdentity') +
					 ", ↗" + this.get('azimuth') + "°";

				// GSM
				if (this.has('bcch'))
					s += ", BCCH: " + this.get('bcch');
				// UMTS
				if (this.has('scramblingCode'))
					s += ", SC: " + this.get('scramblingCode');
				if (this.has('uarfcn'))
					s += ", UARFCN: " + this.get('uarfcn');
				
				// LTE
				if (this.has('pci'))
					s += ", PCI: " + this.get('pci');
				if (this.has('earfcn'))
					s += ", EARFCN: " + this.get('earfcn');

				s += ")";
				return s;
			}
		});

		return Sector;
	}
);
