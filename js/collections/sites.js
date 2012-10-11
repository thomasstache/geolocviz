define(
	["backbone",
	 "models/site"],

	function(Backbone, Site) {

		var SiteList = Backbone.Collection.extend({
			model: Site,
		});

		return SiteList;
	}
);
