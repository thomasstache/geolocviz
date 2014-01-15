define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/legend", "hbs!../../templates/colorscale"],

	function($, _, Backbone, legendTemplate, colorScaleTemplate) {

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

			initialize: function() {

				this.settings = this.options.settings;
				this.appstate = this.options.appstate;

				// listen to some state changes
				if (this.appstate) {
					this.appstate.on("change:referenceLocationsAvailable", this.onStateChanged, this);
					this.appstate.on("change:candidateLocationsAvailable", this.onStateChanged, this);
					this.appstate.on("change:markerColorMapper", this.onColorMapperChanged, this);
				}

				if (this.settings) {
					this.settings.on("change:useDynamicMarkerColors", this.onScaleSettingsChanged, this);
					this.settings.on("change:markerColorAttribute", this.onColorMapperChanged, this);
				}

				// translate the colors dictionary into an array for our templating
				var colorDict = this.options.colors;
				this.colorData = {
					swatches: []
				};

				for (var key in colorDict) {
					this.colorData.swatches.push(colorDict[key]);
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

				var colorMapper = this.appstate.get("markerColorMapper");
				if (colorMapper !== null) {

					var scaleSetup = colorMapper.getInfo();

					var context = {
						attribute: this.settings.get("markerColorAttribute"),
						bgGradient: "linear-gradient(to right, blue, cyan, lime, yellow, red)",
						scaleMin: scaleSetup.scaleMin,
						scaleMax: scaleSetup.scaleMax
					};
					this.$colorScale.html(colorScaleTemplate(context));
				}

				return this;
			},

			/**
			 * Update item visibility according to current state.
			 */
			onStateChanged: function(event) {

				if (event.changed.referenceLocationsAvailable !== undefined) {
					this.showLegendItem("R", event.changed.referenceLocationsAvailable);
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

				this.$swatchList.toggleClass("hidden", bDynamicMarkerColors);
				this.$colorScale.toggleClass("hidden", !bDynamicMarkerColors);
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

					var setting = "drawMarkers_" + li.dataset.markertype;

					var newValue = !this.settings.get(setting);
					this.settings.set(setting, newValue);

					$(li).toggleClass("markerOff", !newValue);
				}
			}
		});

		return LegendView;
	}
);
