define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/sessioninfo"],

	function($, _, Backbone, tmplFct) {

		var SessionInfoView = Backbone.View.extend({
			el: $("#sessionInfo"),

			context: {},

			initialize: function() {

				this.render();
			},

			/**
			 * Update the view for the session
			 */
			update: function(session) {

				if (session) {

					this.context = session;
				}
				else {
					// clear the view
					this.context = {};
				}
				this.render();
			},

			render: function() {

				this.$el.html(tmplFct(this.context));
				return this;
			}
		});

		return SessionInfoView;
	}
);
