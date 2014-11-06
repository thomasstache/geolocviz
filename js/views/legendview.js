define(
	["jquery", "underscore", "backbone",
	 "types/colormapper",
	 "hbs!templates/legend", "hbs!templates/colorscale"],

	function($, _, Backbone, ColorMapper, legendTemplate, colorScaleTemplate) {

		var LegendView = Backbone.View.extend({

			el: $("#mapLegend"),

			events: {
				"click .legendItem" : "legendItemClicked"
			},

			/** @type {AppState} the shared app state */
			appstate: null,
			/** @type {Settings} the settings model */
			settings: null,
			/** @type {Object} properties hash for the template */
			colorData: null,

			$swatchList: null,
			$colorScale: null,

			initialize: function(options) {

				this.settings = options.settings;
				this.appstate = options.appstate;

				// listen to some state changes
				if (this.appstate) {
					this.listenTo(this.appstate, "change:resultsAvailable", this.onResultsChanged);
					this.listenTo(this.appstate, "change:referenceLocationsAvailable", this.onStateChanged);
					this.listenTo(this.appstate, "change:candidateLocationsAvailable", this.onStateChanged);
					this.listenTo(this.appstate, "change:markerColorMapper", this.onColorMapperChanged);
					this.listenTo(this.appstate, "change:heatmapActive", this.onHeatmapChanged);
				}

				if (this.settings) {
					this.listenTo(this.settings, "change:useDynamicMarkerColors", this.onScaleSettingsChanged);
					this.listenTo(this.settings, "change:markerColorAttribute", this.onColorMapperChanged);
					this.listenTo(this.settings, "change:heatmapMaxIntensity", this.renderColorScale);
				}

				// translate the colors dictionary into an array for our templating
				var colorDict = options.colors;
				this.colorData = {
					swatches: []
				};

				for (var key in colorDict) {
					var color = colorDict[key];
					color.enabled = this.settings.get(this.getSettingsName(color.smb));
					this.colorData.swatches.push(color);
				}

				this.$swatchList = this.$("#swatchList");
				this.$colorScale = this.$("#colorScale");

				this.render();
			},

			render: function() {

				this.$swatchList.html(legendTemplate(this.colorData));
				this.renderColorScale();

				this.showLegendItem("R", this.appstate.get("referenceLocationsAvailable"));
				this.showLegendItem("C", this.appstate.get("candidateLocationsAvailable"));

				this.toggleLegendMode(this.settings.get("useDynamicMarkerColors"));
				return this;
			},

			// Render only the legend for dynamic marker colors.
			renderColorScale: function() {

				var context = {};

				if (this.appstate.get("heatmapActive")) {
					context = {
						attribute: "Count",
						bgGradient: "linear-gradient(to right, lime, yellow, red)",
						scaleMin: 1,
						scaleMax: this.settings.get("heatmapMaxIntensity"),
					};
				}
				else {

					var colorMapper = this.appstate.get("markerColorMapper");
					if (colorMapper !== null) {

						var scaleSetup = colorMapper.getInfo();
						context = {
							attribute: this.settings.get("markerColorAttribute"),
							bgGradient: "linear-gradient(to right, blue, cyan, lime, yellow, red)",
							scaleMin: scaleSetup.scaleMin,
							scaleMax: scaleSetup.scaleMax
						};
					}
				}
				this.$colorScale.html(colorScaleTemplate(context));

				return this;
			},

			// Show/hide legend when resultsAvailable state changes
			onResultsChanged: function(event) {

				if (event.changed.resultsAvailable)
					this.$el.show();
				else
					this.$el.hide();
			},

			onHeatmapChanged: function(event) {

				if (event.changed.heatmapActive !== undefined) {

					this.renderColorScale();
					this.toggleLegendMode(this.settings.get("useDynamicMarkerColors"));
				}
			},

			/**
			 * Update item visibility according to current state.
			 */
			onStateChanged: function(event) {

				if (event.changed.referenceLocationsAvailable !== undefined) {
					var bReferenceLocations = event.changed.referenceLocationsAvailable;
					if (bReferenceLocations)
						this.toggleLegendMode(false);
					this.showLegendItem("R", bReferenceLocations);
				}
				if (event.changed.candidateLocationsAvailable !== undefined) {
					this.showLegendItem("C", event.changed.candidateLocationsAvailable);
				}
			},

			/**
			 * Update color scale legend according to ColorMapper.
			 */
			onColorMapperChanged: function(event) {

				if (event.changed.markerColorMapper !== undefined ||
					event.changed.markerColorAttribute !== undefined) {

					this.renderColorScale();
				}
			},

			/**
			 * Handler for "change" event on Settings.
			 */
			onScaleSettingsChanged: function(event) {

				if (event.changed.useDynamicMarkerColors !== undefined) {
					this.toggleLegendMode(event.changed.useDynamicMarkerColors);
				}
			},

			// Toggle rendering mode, display either swatches for categories or color scale.
			toggleLegendMode: function(bDynamicMarkerColors) {

				var bShowColorScale = bDynamicMarkerColors || this.appstate.get("heatmapActive");

				this.$swatchList.toggleClass("hidden", bShowColorScale);
				this.$colorScale.toggleClass("hidden", !bShowColorScale);
			},

			showLegendItem: function(symbol, bShow) {

				// use an attribute selector to select item according to the "smb" property used in our template
				var selector = "li[data-markertype='" + symbol + "']";
				var $item = this.$(selector);
				if ($item && $item.length === 1) {
					$item.toggleClass("hidden", !bShow);
				}
			},

			/**
			 * Handler for clicks on individual legend items. Toggles a certain marker type.
			 * @param  {Event} evt jQuery click event
			 */
			legendItemClicked: function(evt) {

				if (!(evt.currentTarget && evt.currentTarget.classList.contains("legendItem")))
					return;

				var li = evt.currentTarget;
				if (li.dataset &&
					li.dataset.markertype) {

					var setting = this.getSettingsName(li.dataset.markertype);

					var newValue = !this.settings.get(setting);
					this.settings.set(setting, newValue);

					$(li).toggleClass("markerOff", !newValue);
				}
			},

			getSettingsName: function(smb) {
				return "drawMarkers_" + smb;
			}
		});

		return LegendView;
	}
);
