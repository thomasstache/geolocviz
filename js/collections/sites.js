define(
	["backbone",
	 "models/site"],

	function(Backbone, Site) {

		var SiteList = Backbone.Collection.extend({
			model: Site,

			/**
			 * Returns the first site whose sector list has a match for all the properties.
			 * @param  {Object} sectorProps List of key-value pairs that should match
			 * @return {Array}
			 */
			findSiteWithSector: function(sectorProps) {

				var site = this.find(function(site) {

					var matchingSectors = site.getSectors().where(sectorProps);
					return matchingSectors &&
						   matchingSectors.length > 0;
				});
				return site;
			}
		});

		return SiteList;
	}
);
