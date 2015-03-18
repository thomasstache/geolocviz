define(
	["backbone",
	 "models/sector"],

	function(Backbone, Sector) {

		var SectorList = Backbone.Collection.extend({
			model: Sector,

			constructor: function SectorList() {
				Backbone.Collection.prototype.constructor.apply(this, arguments);
			},
		});

		return SectorList;
	}
);
