define(
	["backbone",
	 "models/site", "types/searchnetworkresult"],

	function(Backbone, Site, SearchNetworkResult) {

		var SiteList = Backbone.Collection.extend({
			model: Site,

			constructor: function SiteList() {
				Backbone.Collection.prototype.constructor.apply(this, arguments);
			},

			/**
			 * Returns the first site whose sector list has a match for all the properties.
			 * @param  {Object} sectorProps Literal with key-value pairs that should match
			 * @return {Site}
			 */
			findSiteWithSector: function(sectorProps) {

				var site = this.find(function(site) {
					return hasSectorWithProperties(site, sectorProps);
				});
				return site || null;
			},

			/**
			 * Finds the (first) sector matching the given properties.
			 * @param  {Object} sectorProps Literal with key-value pairs that should match (preferably the sector name)
			 * @return {SearchNetworkResult}
			 */
			findSector: function(sectorProps) {

				var site = this.findSiteWithSector(sectorProps);
				var sector = null;

				if (site)
					sector = site.get("sectors").findWhere(sectorProps);

				return new SearchNetworkResult(site || null, sector);
			},

			/**
			 * Returns an array of sites whose sector lists have a match for all the properties.
			 * @param  {Object} sectorProps Literal with key-value pairs that should match
			 * @return {Array}
			 */
			filterSitesWithSectors: function(sectorProps) {

				var sites = this.filter(function(site) {
					return hasSectorWithProperties(site, sectorProps);
				});
				return sites || [];
			},
		});

		function hasSectorWithProperties(site, sectorProps) {

			var matchingSectors = site.getSectors(sectorProps);
			return matchingSectors &&
			       matchingSectors.length > 0;
		}

		return SiteList;
	}
);
