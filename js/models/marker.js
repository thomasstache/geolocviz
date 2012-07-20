define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var Marker = Backbone.Model.extend({

			defaults: {
				// marker type
				type: "",
				// reference to the GoogleMaps Marker
				marker: null,
			},

			// ensure to remove the pin from the map and release GoogleMaps Marker object
			clear: function() {
				if (this.has('marker')) {
					this.get('marker').setMap(null);
					this.set('marker', null);
				}
			}
		});

		return Marker;
	}
);
