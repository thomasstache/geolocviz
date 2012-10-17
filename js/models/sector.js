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

				// GSM sector attributes
				bcch: -1,
				bsic: -1,

				// WCDMA sector attributes
				scramblingCode: -1,
				uarfcn: -1,
			},

			initialize: function() {
			},
		});

		return Sector;
	}
);
