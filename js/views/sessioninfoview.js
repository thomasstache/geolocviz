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

			initialize: function() {

				this.model.on("change:selectedSession", this.onSessionChanged, this);
				this.model.on("change:focussedSessionId", this.updateControls, this);

				this.$toolbar = $(".toolbar");
				this.$focusBtn = $(".button.focus-session");
				this.$unfocusBtn = $(".button.unfocus-session");
			},

			onSessionChanged: function(model, value, options) {

				this.updateControls();
				this.render();
			},

			// Render the template with the current context data.
			render: function() {

				var context = this.model.get("selectedSession");
				$("#sessionInfo").html(tmplFct(context !== null ? context : {}));
				return this;
			},

			/**
			 * Click handler for the "focus session" button. Trigger "focus" event.
			 */
			onFocusSessionClicked: function() {

				this.trigger("session:focussed", this.model.get("selectedSession"));
			},

			/**
			 * Click handler for the "done" button. Trigger "unfocus" event.
			 */
			onUnfocusSessionClicked: function() {

				this.trigger("session:unfocussed");
			},

			updateControls: function() {

				var session = this.model.get("selectedSession");
				var focussedSessionId = this.model.get("focussedSessionId");
				var canFocus = (session &&
								focussedSessionId !== session.id);

				this.$focusBtn.prop("disabled", !canFocus);
				this.$unfocusBtn.prop("disabled", focussedSessionId < 0);

				this.$toolbar.toggleClass("hidden", session === null);
			},
		});

		return SessionInfoView;
	}
);
