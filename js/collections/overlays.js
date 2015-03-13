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

			/**
			 * Removes all overlays with the given type from the map and destroys them.
			 * @param {OverlayTypes} type
			 */
			removeByType: function(type) {

				var list = this.byType(type);

				_.each(list, function(overlay) { overlay.removeFromMap(); });
				this.remove(list);
			},

			/**
			 * Store a reference to the maps overlay object by type.
			 * @param {OverlayTypes} type The type of the overlay
			 * @param {Overlay} overlay   The GoogleMaps overlay object. One of {Marker/Line/Polyline}
			 * @param {String}  category  (optional) for results we can store the category for filtering.
			 */
			register: function(type, overlay, category) {
				this.add({
					type: type,
					category: category,
					ref: overlay
				}, { silent: true });
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
