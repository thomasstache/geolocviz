define(
	["underscore", "backbone",
	 "views/map/baselayer",
	 "models/site", "models/sector",
	 "types/position", "types/googlemapsutils", "types/colormapper"],

	function(_, Backbone,
			 BaseLayer,
			 Site, Sector,
			 Position, GoogleMapsUtils, ColorMapper) {

		var SectorColors = Object.freeze({
			DEFAULT: { color: "#333", fillcolor: "#6AF" },
			SMLCELL:  { color: "#5B720E", fillcolor: "#B5E61D" }, /* green*/
			INDOOR:  { color: "#A349A4", fillcolor: "#C878E7"}, /* violet */
		});

		var OverlayTypes = Object.freeze({
			SITE: "siteSymbol",
			SECTOR: "sectorSymbol",
			SELECTIONVIZ: "selectionViz"
		});

		var Z_Index = Object.freeze({
			HIGHLIGHT: -10, // TS: only negative values really put the highlight under the result markers
			SITE: 10,
			SECTOR: 20,
			ONTOP: 200, // additional offset to bump markers to top
		});

		// The initial scale for sector symbols, basis for adaptive scaling of overlapping symbols.
		var DEFAULT_SECTOR_SCALE = 2.0;

		// "map" of already created Marker icons by type
		var IconCache = {};

		/**
		 * Validate LatLngs. Returns false if one of the coordinates is NaN.
		 * @param {LatLng} latLng
		 */
		function isValidLatLng(latLng) {
			return !isNaN(latLng.lat()) &&
				   !isNaN(latLng.lng());
		}

		/**
		 * Radio Network Map Layer.
		 * Emits the following events: event name (payload)
		 *   site:selected (Site model)
		 *   sector:selected (Sector model)
		 *   reset
		 */
		var NetworkLayer = BaseLayer.extend({

			constructor: function NetworkLayer() {
				BaseLayer.prototype.constructor.apply(this, arguments);
			},

			/** @type {Marker} reference to overlay used to highlight the selected site */
			selectedSiteHighlight: null,

			// offset applied to the z-index of site/sector markers according to 'drawNetworkOnTop' setting
			networkMarkerZOffset: 0,

			// maps site attribute to colors
			colorMapper: null,

			initialize: function(options) {

				BaseLayer.prototype.initialize.apply(this, [options]);

				this.listenTo(this.collection, "reset", this.deleteNetworkOverlays);

				// listen for settings changes
				this.listenTo(this.settings, "change:useDynamicSiteColors", this.updateSiteColors);
				this.listenTo(this.settings, "change:drawNetworkOnTop", this.onSettingsChanged);

				this.listenTo(this.appstate, "change:selectedSite", this.selectedSiteChanged);

				this.setNetworkOnTop(this.settings.get("drawNetworkOnTop"));
			},

			/**
			 * Update map overlay visibility according to current settings.
			 */
			onSettingsChanged: function(event) {

				if (event.changed.drawNetworkOnTop !== undefined) {
					this.setNetworkOnTop(event.changed.drawNetworkOnTop);
				}
			},

			selectedSiteChanged: function(event) {

				var site = event.changed.selectedSite;
				this.highlightSite(site);
			},

			/**
			 * Redraws site symbols after settings changes.
			 */
			updateSiteColors: function() {

				// remove markers to change
				this.overlays.removeByType(OverlayTypes.SITE);

				// redraw all the markers
				this.drawSiteMarkers(false);
			},

			/****     Drawing     ****/

			draw: function() {

				this.resetBounds();

				this.drawSiteMarkers(true);
			},

			/**
			 * Removes all site/sector overlays from the map.
			 */
			deleteNetworkOverlays: function() {

				this.highlightSite(null);
				this.overlays.removeByType(OverlayTypes.SITE);
				this.overlays.removeByType(OverlayTypes.SECTOR);
				this.resetBounds();

				this.trigger("reset");
			},

			/**
			 * Draw markers for all sites.
			 * @param  {Boolean} bZoomToNetwork Controls whether the current bounds should be updated
			 */
			drawSiteMarkers: function(bZoomToNetwork) {

				if (this.settings.get('useDynamicSiteColors'))
					this.configureColorMapper();

				// capture the "this" scope
				var view = this;
				this.collection.each(function(site) {
					view.drawSite(site, bZoomToNetwork);
				});
			},

			/**
			 * Creates a marker for a site and adds it to the map.
			 * @param  {Site}    site           The model for the site
			 * @param  {Boolean} bZoomToNetwork Controls whether the current bounds should be updated
			 */
			drawSite: function(site, bZoomToNetwork) {

				var view = this;
				var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));

				// helper function to collect and format tooltip data
				function makeTooltip(site) {

					var lines = site.getSectors().map(function(sector){
						return sector.getTooltipText();
					});
					lines.unshift(site.get('id'));
					return lines.join("\n");
				}

				if (isValidLatLng(latLng)) {

					if (bZoomToNetwork)
						this.bounds.extend(latLng);

					var icon, zIndex;
					if (this.settings.get('useDynamicSiteColors') && this.colorMapper !== null) {
						icon = this.getMarkerIcon("dynamic");
						icon.fillColor = this.colorMapper.getColor(site.get('netSegment'));
						zIndex = -99; // magic value making SVG symbols comply (http://stackoverflow.com/a/12070508/103417)
					}
					else {
						icon = this.getMarkerIcon();
						zIndex = Z_Index.SITE + this.networkMarkerZOffset;
					}

					var marker = new google.maps.Marker({
						icon: icon,
						position: latLng,
						map: this.map,
						title: makeTooltip(site),
						zIndex: zIndex
					});
					marker.metaData = {
						model: site
					};
					this.overlays.register(OverlayTypes.SITE, marker);

					// click event to the for the marker
					google.maps.event.addListener(marker, 'click',
						function() {
							// in here "this" is bound to the marker
							view.onSiteClick(this);
						}
					);
				}
			},

			/**
			 * Creates markers for all sectors in the site's SectorList.
			 * The markers are drawn using SVG symbol paths.
			 * @param  {Site} site
			 */
			drawSectorsForSite: function(site) {

				if (site &&
					site.getSectors().length > 0) {

					var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));
					if (isValidLatLng(latLng)) {

						var sectors = site.getSectorsSortedBy('azimuth');
						var lastAzimuth = NaN;
						var scale = DEFAULT_SECTOR_SCALE;

						for (var i = 0; i < sectors.length; i++) {

							var sector = sectors[i];
							var azimuth = sector.get('azimuth');

							// increase the symbol scale if the sector has the same azimuth as the one before
							if (azimuth === lastAzimuth)
								scale += 1.0;
							else
								scale = DEFAULT_SECTOR_SCALE;

							lastAzimuth = azimuth;

							this.drawSector(sector, latLng, scale);
						}
					}
				}
			},

			/**
			 * Draw a symbol for the given sector.
			 * @param  {Sector} sector     The model with the sector's data
			 * @param  {LatLng} siteLatLng The location of the parent site
			 * @param  {Number} scale      (optional) Scaling factor for the symbol size
			 */
			drawSector: function(sector, siteLatLng, scale) {

				var view = this;

				var _scale = scale || DEFAULT_SECTOR_SCALE;
				var azi = sector.get('azimuth');

				var colorDef;
				var cellType = sector.get('cellType');
				if (cellType == Sector.TYPE_INDOOR) {
					colorDef = SectorColors.INDOOR;
				}
				else if (cellType == Sector.TYPE_SMALLCELL) {
					colorDef = SectorColors.SMLCELL;
				}
				else {
					colorDef = SectorColors.DEFAULT;
				}

				var marker = new google.maps.Marker({

					icon: {
						path: "M0,0 l0,-6 -1,0 1,-4 1,4 -1,0",
						rotation: azi,
						fillColor: colorDef.fillcolor,
						fillOpacity: 1,
						scale: _scale,
						strokeColor: colorDef.color,
						strokeOpacity: 0.6,
						strokeWeight: 2,
					},
					position: siteLatLng,
					map: this.map,
					title: sector.getTooltipText(),
					zIndex: Z_Index.SECTOR + this.networkMarkerZOffset - _scale // the bigger the symbol, the lower we place it
				});

				marker.metaData = {
					model: sector
				};

				// click event to the for the marker
				google.maps.event.addListener(marker, 'dblclick',
					function() {
						view.onSectorDblClick(this);
					}
				);

				this.overlays.register(OverlayTypes.SECTOR, marker);
			},

			/**
			 * Handler for clicks on map markers.
			 */
			onSiteClick: function(siteMarker) {

				if (siteMarker && siteMarker.metaData) {

					var md = siteMarker.metaData;
					if (md.model)
						this.trigger("site:selected", md.model);
				}
			},

			/**
			 * Handler for double-clicks on sector markers.
			 */
			onSectorDblClick: function(marker) {

				if (marker && marker.metaData) {

					var md = marker.metaData;
					if (md.model) {

						var sector = md.model;
						this.trigger("sector:selected", sector);
					}
				}
			},

			/**
			 * Highlight the given site by drawing an overlay.
			 * @param {Site}    site          The model of the site
			 */
			highlightSite: function(site) {

				if (site) {

					if (!this.selectedSiteHighlight) {
						// create overlay for reuse for all site highlighting needs
						this.selectedSiteHighlight = this.createHighlightForSites();
					}

					var latLng = GoogleMapsUtils.makeLatLng(site.get('position'));
					var bShow = isValidLatLng(latLng);
					if (bShow) {
						// update the position
						this.selectedSiteHighlight.setPosition(latLng);
					}
					this.setMarkerVisible(this.selectedSiteHighlight, bShow);

					if (bShow) {
						var bounds = this.map.getBounds();
						// check manually, as fitBounds() even zooms out for unchanged bounds
						if (!bounds.contains(latLng)){
							bounds.extend(latLng);
							this.map.fitBounds(bounds);
						}
					}
				}
				else {
					// reset previous highlighted site
					this.setMarkerVisible(this.selectedSiteHighlight, false);
				}

				// draw sectors for the site
				this.overlays.removeByType(OverlayTypes.SECTOR);
				this.drawSectorsForSite(site);
			},

			/**
			 * Creates a marker with a custom graphic to highlight sites and adds it to the map.
			 * @return {Marker} reference to the created marker
			 */
			createHighlightForSites: function() {

				var marker = new google.maps.Marker({
					icon: this.getMarkerIcon("selected"),
					map: this.map,
					zIndex: Z_Index.SITE + this.networkMarkerZOffset + 10
				});
				this.overlays.register(OverlayTypes.SELECTIONVIZ, marker);

				return marker;
			},

			/**
			 * Return the Marker icon for the given type. Creates it on first request and caches it.
			 * @param  {String} option    (optional) parameters for the type (e.g. letters "M/S/I" for AXF dot markers)
			 * @return {MarkerImage}
			 */
			getMarkerIcon: function(option) {

				// option is optional
				option = option || "";

				var key = "site_" + option;

				// already in cache?
				if (IconCache[key] !== undefined) {
					return IconCache[key];
				}

				var imagePath = null;
				var icon;

				// the common size+offsets of our AXF marker images
				var geometry = {
					size: new google.maps.Size(10,10),
					origin: new google.maps.Point(0,0),
					anchor: new google.maps.Point(5,5)
				};

				if (option == "dynamic") {
					icon = {
						path: google.maps.SymbolPath.CIRCLE,
						fillColor: "#000", // dummy color
						fillOpacity: 1,
						scale: 3,
						strokeColor: "#333",
						strokeOpacity: 0.6,
						strokeWeight: 1,
					};
					// return directly, no MarkerImage is needed.
					return icon;
				}
				else if (option == "selected") {
					imagePath = 'images/siteSelectedBig.png';
					geometry.size = new google.maps.Size(13,13);
					geometry.anchor = new google.maps.Point(6,6);
				}
				else {
					imagePath = 'images/site.png';
					geometry.size = new google.maps.Size(9,9);
					geometry.anchor = new google.maps.Point(4,4);
				}

				icon = new google.maps.MarkerImage(imagePath,
												   geometry.size, geometry.origin, geometry.anchor);

				IconCache[key] = icon;

				return icon;
			},

			/**
			 * Configures ColorMapper for the network symbols.
			 */
			configureColorMapper: function() {

				var values = this.collection.pluck('netSegment');
				// discard illegal values
				values = _.filter(values, function(num){ return num !== -1; });

				if (values.length > 0) {

					var min = _.min(values),
						max = _.max(values);

					if (this.colorMapper === null)
						this.colorMapper = new ColorMapper(min, max);
					else
						this.colorMapper.setLimits(min, max);
				}
				else {
					this.colorMapper = null;
				}
			},



			/****     Z-Index Handling     ****/

			/**
			 * Change the z-index offset for network markers and updates all existing markers.
			 * @param {Boolean} drawNetworkOnTop True for "on top", false for below.
			 */
			setNetworkOnTop: function(drawNetworkOnTop) {
				this.networkMarkerZOffset = drawNetworkOnTop ? Z_Index.ONTOP : 0;
				this.updateZIndexForNetworkOverlays();
			},

			/**
			 * Updates the z-index for all network overlays.
			 */
			updateZIndexForNetworkOverlays: function() {

				var sites = this.overlays.byType(OverlayTypes.SITE),
				    sectors = this.overlays.byType(OverlayTypes.SECTOR),
				    overlays = sites.concat(sectors);

				var view = this;

				_.each(
					overlays,
					function(overlay) {
						var marker = overlay.get('ref'),
						    zIndex = overlay.get('type') === OverlayTypes.SITE ? Z_Index.SITE : Z_Index.SECTOR;
						view.setMarkerZIndex(marker, zIndex);
					}
				);

				if (this.selectedSiteHighlight) {
					this.setMarkerZIndex(this.selectedSiteHighlight, Z_Index.SITE + 10);
				}
			},

			/**
			 * Update the z-index of the given marker according to the current "on top" offset.
			 * @param {Marker} marker  Google Maps Marker or Polyline object
			 * @param {Number} zIndex
			 */
			setMarkerZIndex: function(marker, zIndex) {
				if (marker)
					marker.setZIndex(zIndex + this.networkMarkerZOffset);
			},
		});

		return NetworkLayer;
	}
);