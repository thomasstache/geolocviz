define(
	["underscore", "backbone",
	 "templates/helpers/technologyterm"],

	function(_, Backbone, getTechnologyTerm) {

		var Sector = Backbone.Model.extend({

			defaults: {
				// ElementHandle
				id: -1,
				// sector name - not always unique!
				name: "",

				// antenna azimuth in RAD
				azimuth: 0.0,
				// antenna beamwidth
				beamwidth: 0.0,

				// height above ground
				height: null,

				// network system/technology: GSM, WCDMA, LTE...
				technology: null,
				// cell identity, (WCDMA: "WCDMA_CI", GSM: "CI")
				cellIdentity: null,
				// "network segment" in which the cellIdentity is valid (WCDMA: "RNCID", GSM: "LAC")
				netSegment: null,

				// CellType: calculated attribute (0: default, 1: isSmallCell, 2: isIndoor)
				cellType: null,

				// common mapping of channel numbers (bcch, pci or scramblingCode)
				channelNumber: null,

				// GSM sector attributes
				bcch: null,
				bsic: null,

				// WCDMA sector attributes
				scramblingCode: null,
				uarfcn: null,

				// LTE attributes
				pci: null,
				earfcn: null,
			},

			constructor: function Sector() {
				Backbone.Model.prototype.constructor.apply(this, arguments);
			},

			initialize: function() {

				var channel = -1;
				if (this.has('bcch'))
					channel = this.get('bcch');
				else if (this.has('scramblingCode'))
					channel = this.get('scramblingCode');
				else if (this.has('pci'))
					channel = this.get('pci');

				this.set('channelNumber', channel);
			},

			/**
			 * Returns the logical channel of the cell, i.e. BCCH, SC, or PCI
			 * @return {Number} "channel" number or -1
			 */
			getChannelNumber: function() {

				return this.get('channelNumber');
			},

			/**
			 * Returns the transmitting direction. This is used for drawing sectors of a site in the correct order.
			 * @return {Number} the azimuth or -1
			 */
			getEffectiveDirection: function() {

				return this.isOmni() ? -1 : this.get('azimuth');
			},

			/**
			 * Does this sector have an omni-directional antenna?
			 * @return {Boolean}
			 */
			isOmni: function() {
				return !this.has('beamwidth') ||
				        this.get('beamwidth') > 180.0;
			},

			getTooltipText: function() {
				var s = this.get('name') + " (";

				s += "CI: " + this.get('cellIdentity') +
					 ", ↗" + this.get('azimuth') + "°";

				if (this.has('height'))
					s += ", h: " + this.get('height');

				var tech = this.has('technology') ? this.get('technology') : "unknown";
				if (this.has('netSegment'))
					s += ", " + getTechnologyTerm(tech, "netsegment") + ": " + this.get('netSegment');

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
		},
		{
			// known CellTypes
			TYPE_DEFAULT: 0,
			TYPE_SMALLCELL: 1,
			TYPE_INDOOR: 2,
		});

		return Sector;
	}
);
