define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/sessioninfo", "hbs!../../templates/accuracyresultinfo", "hbs!../../templates/statisticsinfo"],

	function($, _, Backbone, sessionTemplate, resultTemplate, statisticsTemplate) {

		var SessionInfoView = Backbone.View.extend({
			el: $("#infoView"),

			events: {
				"click .focus-session": "onFocusSessionClicked",
				"click .unfocus-session": "onUnfocusSessionClicked"
			},

			initialize: function() {

				this.model.on("change:selectedSession", this.onSessionChanged, this);
				this.model.on("change:selectedResult", this.onResultChanged, this);
				this.model.on("change:statistics", this.onStatisticsChanged, this);
				this.model.on("change:focussedSessionId", this.updateSessionControls, this);

				this.$toolbar = $(".toolbar");
				this.$focusBtn = $(".button.focus-session");
				this.$unfocusBtn = $(".button.unfocus-session");
			},

			onSessionChanged: function() {

				this.updateSessionControls();
				this.renderSessionInfo();
				this.renderResultInfo();
			},

			onResultChanged: function() {

				this.renderResultInfo();
			},

			onStatisticsChanged: function() {
				this.renderStatistics();
			},

			// Render the templates with the current context data.
			render: function() {

				this.renderSessionInfo();
				this.renderResultInfo();
				this.renderStatistics();
				return this;
			},

			renderSessionInfo: function() {

				var context = this.model.get("selectedSession");
				$("#sessionInfo").html(sessionTemplate(context !== null ? context : {}));
				return this;
			},

			// Render the result template.
			renderResultInfo: function() {

				var result = this.model.get("selectedResult");
				$("#resultInfo").html(resultTemplate(result !== null ? result.getInfo() : {}));
				return this;
			},

			// Render the statistics template.
			renderStatistics: function() {

				var stats = this.model.get("statistics");
				var context = stats !== null ? stats.toJSON() : {};
				if (context.numResultsAndCandidates &&
					context.numResultsAndCandidates > 0)
					context.hasCandidates = true;

				$("#statistics").html(statisticsTemplate(context));
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

			updateSessionControls: function() {

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
