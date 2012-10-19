define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/legend"],

	function($, _, Backbone, tmplFct) {

		var LegendView = Backbone.View.extend({

			el: $("#mapLegend"),

			events: {
				"click .legendItem" : "legendItemClicked"
			},

			settings: null,
			colorData: null,

			initialize: function() {

				this.settings = this.options.settings;

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
