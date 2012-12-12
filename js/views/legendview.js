define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/legend"],

	function($, _, Backbone, tmplFct) {

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
				}

				// translate the colors dictionary into an array for our templating
				var colorDict = this.options.colors;
				this.colorData = {
					colors: []
				};

				for (var prop in colorDict) {
					this.colorData.colors.push(colorDict[prop]);
				}

				this.render();
			},

			render: function() {

				this.$el.html(tmplFct(this.colorData));
				this.showLegendItem("R", this.appstate.get("referenceLocationsAvailable"));
				this.showLegendItem("C", this.appstate.get("candidateLocationsAvailable"));
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
