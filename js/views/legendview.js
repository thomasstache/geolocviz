define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/legend"],

	function($, _, Backbone, tmplFct) {

		var LegendView = Backbone.View.extend({

			el: $("#mapLegend"),

			colorData: null,

			initialize: function() {

				var colorDict = this.options.colors;
				this.colorData = {
					colors: []
				};

				for (var prop in colorDict) {
					this.colorData.colors.push(colorDict[prop]);
				}
			},

			render: function() {

				this.$el.html(tmplFct(this.colorData));
			}
		});

		return LegendView;
	}
);
