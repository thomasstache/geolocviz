define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/sessioninfo"],

	function($, _, Backbone, tmplFct) {

		var SessionInfoView = Backbone.View.extend({
			el: $("#sessionInfo"),

			events: {
				"click .focus-session": "onFocusSessionClicked",
				"click .unfocus-session": "onUnfocusSessionClicked"
			},

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

			// Render the template with the current context data.
			render: function() {

				this.$el.html(tmplFct(this.context));
				return this;
			},

			/**
			 * Click handler for the "focus session" button. Trigger "focus" event.
			 */
			onFocusSessionClicked: function(evt) {

				evt.preventDefault(); // don't navigate
				if (this.context) {
					this.trigger("session:focussed", this.context);
				}
			},

			/**
			 * Click handler for the "done" button. Trigger "unfocus" event.
			 */
			onUnfocusSessionClicked: function(evt) {

				evt.preventDefault(); // don't navigate
				this.trigger("session:unfocussed");
			}
		});

		return SessionInfoView;
	}
);
