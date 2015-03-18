define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Overlay = Backbone.Model.extend({

			defaults: {
				// marker type
				type: "",
				// marker category
				category: "",
				// reference to the GoogleMaps object
				ref: null,
			},

			constructor: function Overlay() {
				Backbone.Model.prototype.constructor.apply(this, arguments);
			},

			// ensure to remove the pin from the map and release GoogleMaps object
			removeFromMap: function() {

				if (this.has('ref')) {
					this.get('ref').setMap(null);
					this.set('ref', null);
				}
			}
		});

		return Overlay;
	}
);
