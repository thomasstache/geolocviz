define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/sessioninfo", "hbs!../../templates/accuracyresultinfo"],

	function($, _, Backbone, sessionTemplate, resultTemplate) {

		var SessionInfoView = Backbone.View.extend({
			el: $("#infoView"),

			events: {
				"click .focus-session": "onFocusSessionClicked",
				"click .unfocus-session": "onUnfocusSessionClicked"
			},

			initialize: function() {

				this.model.on("change:selectedSession", this.onSessionChanged, this);
				this.model.on("change:selectedResult", this.onResultChanged, this);
				this.model.on("change:focussedSessionId", this.updateControls, this);

				this.$toolbar = $(".toolbar");
				this.$focusBtn = $(".button.focus-session");
				this.$unfocusBtn = $(".button.unfocus-session");
			},

			onSessionChanged: function() {

				this.updateControls();
				this.render();
			},

			onResultChanged: function() {

				this.renderResultInfo();
			},

			// Render the templates with the current context data.
			render: function() {

				this.renderSessionInfo();
				this.renderResultInfo();
				return this;
			},

			renderSessionInfo: function() {

				var context = this.model.get("selectedSession");
				$("#sessionInfo").html(sessionTemplate(context !== null ? context : {}));
				return this;
			},

			// Render the templates with the current context data.
			renderResultInfo: function() {

				var result = this.model.get("selectedResult");
				$("#resultInfo").html(resultTemplate(result !== null ? result.getInfo() : {}));
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
