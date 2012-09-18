define(
	["underscore", "backbone",
	"models/overlay"],

	function(_, Backbone, Overlay) {

		var OverlayList = Backbone.Collection.extend({
			model: Overlay,

			removeAll: function() {
				this.each(function(overlay) {
					overlay.removeFromMap();
				});
				this.reset();
			},

			// returns the subset of items matching the given type
			byType: function(type) {

				return this.filter(
					function(overlay) { return overlay.get('type') === type; }
				);
			}
		});

		return OverlayList;
	}
);
