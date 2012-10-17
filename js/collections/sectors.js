define(
	["backbone",
	 "models/sector"],

	function(Backbone, Sector) {

		var SectorList = Backbone.Collection.extend({
			model: Sector,
		});

		return SectorList;
	}
);
