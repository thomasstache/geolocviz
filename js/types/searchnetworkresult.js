define(

	function() {
		/**
		 * Return type for SiteList.findSector().
		 * @param {Site}   site   The site containing the sector or null
		 * @param {Sector} sector The found sector or null
		 */
		var SearchNetworkResult = function(site, sector) {
			this.site = site;
			this.sector = sector;
		};

		return SearchNetworkResult;
	}
);