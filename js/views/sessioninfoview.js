define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/sessioninfo"],

	function($, _, Backbone, tmplFct) {

		var SessionInfoView = Backbone.View.extend({
			el: $("#infoView"),

			events: {
				"click .focus-session": "onFocusSessionClicked",
				"click .unfocus-session": "onUnfocusSessionClicked"
			},

			// the template input data, a Session model
			session: null,

			// id of the last focussed session
			focussedSessionId: -1,

			initialize: function() {

				this.render();

				this.$toolbar = $(".toolbar");
				this.$focusBtn = $(".button.focus-session");
				this.$unfocusBtn = $(".button.unfocus-session");
			},

			/**
			 * Update the view for the session
			 */
			update: function(session) {

				if (session &&
				    (this.session === null || session.id !== this.session.id)) {

					this.session = session;
				}
				else {
					// clear the view
					this.session = null;
					this.focussedSessionId = -1;
				}

				this.updateControls();
				this.render();
			},

			// Render the template with the current context data.
			render: function() {

				$("#sessionInfo").html(tmplFct(this.session ? this.session : {}));
				return this;
			},

			/**
			 * Click handler for the "focus session" button. Trigger "focus" event.
			 */
			onFocusSessionClicked: function() {

				if (this.session) {
					this.trigger("session:focussed", this.session);
					this.focussedSessionId = this.session.id;
				}
				this.updateControls();
			},

			/**
			 * Click handler for the "done" button. Trigger "unfocus" event.
			 */
			onUnfocusSessionClicked: function() {

				this.trigger("session:unfocussed");
				this.focussedSessionId = -1;
				this.updateControls();
			},

			updateControls: function() {

				var canFocus = (this.session !== null &&
				                       this.focussedSessionId !== this.session.id);

				this.$focusBtn.prop("disabled", !canFocus);
				this.$unfocusBtn.prop("disabled", this.focussedSessionId < 0);

				this.$toolbar.toggleClass("hidden", this.session === null);
			},
		});

		return SessionInfoView;
	}
);
