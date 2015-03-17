define(
	["underscore", "backbone",
	"models/overlay"],

	function(_, Backbone, Overlay) {

		var OverlayList = Backbone.Collection.extend({
			model: Overlay,

			constructor: function OverlayList() {
				Backbone.Collection.prototype.constructor.apply(this, arguments);
			},

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
			 * @param {MVCObject} marker  The GoogleMaps object. One of {Marker/Line/Polyline}
			 * @param {String}  category  (optional) for results we can store the category for filtering.
			 */
			register: function(type, marker, category) {
				this.add(new Overlay({
					type: type,
					category: category,
					ref: marker
				}), { silent: true });
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
