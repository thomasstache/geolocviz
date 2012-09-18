define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Overlay = Backbone.Model.extend({

			defaults: {
				// marker type
				type: "",
				// reference to the GoogleMaps object
				ref: null,
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
