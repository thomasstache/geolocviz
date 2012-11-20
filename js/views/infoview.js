define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/sessioninfo", "hbs!../../templates/resultinfo",
	 "hbs!../../templates/statisticsinfo", "hbs!../../templates/siteinfo"],

	function($, _, Backbone, sessionTemplate, resultTemplate, statisticsTemplate, siteTemplate) {

		/**
		 * Info View.
		 * Emits the following events:
		 *   session:focussed
		 *   session:unfocussed
		 *   result:nav-first
		 *   result:nav-prev
		 *   result:nav-next
		 *   result:nav-last
		 *   result:lookupElement
		 */
		var InfoView = Backbone.View.extend({
			el: $("#infoView"),

			events: {
				"click .focus-session": "onFocusSessionClicked",
				"click .unfocus-session": "onUnfocusSessionClicked",
				"click .results-first": "onFirstResultClicked",
				"click .results-prev": "onPrevResultClicked",
				"click .results-next": "onNextResultClicked",
				"click .results-last": "onLastResultClicked",
				"click .lookup-element": "onLookupElementClicked",
			},

			initialize: function() {

				this.model.on("change:selectedSession", this.onSessionChanged, this);
				this.model.on("change:selectedResult", this.onResultChanged, this);
				this.model.on("change:selectedSite", this.onSiteChanged, this);
				this.model.on("change:statistics", this.onStatisticsChanged, this);
				this.model.on("change:focussedSessionId", this.updateSessionControls, this);
				this.model.on("change:radioNetworkAvailable", this.updateResultsControls, this);

				this.$tbSessionToolbar = $(".toolbar.sessionControls");
				this.$tbResultsToolbar = $(".toolbar.resultControls");

				this.$focusBtn = $(".button.focus-session");
				this.$unfocusBtn = $(".button.unfocus-session");
				this.$navFirstBtn = $(".button.results-first");
				this.$navPrevBtn = $(".button.results-prev");
				this.$navNextBtn = $(".button.results-next");
				this.$navLastBtn = $(".button.results-last");

				this.$lookupElementBtn = $(".button.lookup-element");
			},

			onSessionChanged: function() {

				this.updateSessionControls();
				this.renderSessionInfo();
				this.renderResultInfo();
			},

			onResultChanged: function() {

				this.updateResultsControls();
				this.renderResultInfo();
			},

			onSiteChanged: function() {

				this.renderSiteInfo();
			},

			onStatisticsChanged: function() {
				this.renderStatistics();
			},

			// Render the templates with the current context data.
			render: function() {

				this.renderSessionInfo();
				this.renderResultInfo();
				this.renderSiteInfo();
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

			// Render the site template
			renderSiteInfo: function() {

				var site = this.model.get("selectedSite");
				var context = site !== null ? site.getInfo() : {};
				$("#siteInfo").html(siteTemplate(context));
				return this;
			},

			// Render the statistics template.
			renderStatistics: function() {

				var stats = this.model.get("statistics");
				var context = stats !== null ? stats.toJSON() : {};

				// add some flags to be used in template
				if (context.numResultsAndCandidates &&
					context.numResultsAndCandidates > 0)
					context.hasCandidates = true;

				if (context.numSites && context.numSites > 0)
					context.hasNetwork = true;

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

				this.$tbSessionToolbar.toggleClass("hidden", session === null);
			},

			/**
			 * Click handlers for the result navigation buttons.
			 */
			onFirstResultClicked: function() {
				this.triggerNavigationEvent("nav-first");
			},
			onNextResultClicked: function() {
				this.triggerNavigationEvent("nav-next");
			},
			onPrevResultClicked: function() {
				this.triggerNavigationEvent("nav-prev");
			},
			onLastResultClicked: function() {
				this.triggerNavigationEvent("nav-last");
			},

			triggerNavigationEvent: function(eventType) {
				this.trigger("result:" + eventType, this.model.get("selectedResult"));
			},

			/**
			 * Click handler for the "lookup element" button.
			 * If the result has a cell reference, the "result:lookupElement" event is triggered.
			 * The event payload is an object containing primaryCellId and controllerId.
			 */
			onLookupElementClicked: function() {

				var result = this.model.get("selectedResult");
				if (result.has("primaryCellId") && result.has("controllerId")) {

					var query = {
						primaryCellId: result.get("primaryCellId"),
						controllerId: result.get("controllerId")
					};
					this.trigger("result:lookupElement", query);
				}
			},

			/* Updates toolbar button (enabled/visibility) states on result change. */
			updateResultsControls: function() {

				var result = this.model.get("selectedResult");

				var canNavigateBwd = result !== null && result.hasPrevious();
				var canNavigateFwd = result !== null && result.hasNext();

				this.$navFirstBtn.prop("disabled", !canNavigateBwd);
				this.$navPrevBtn.prop("disabled", !canNavigateBwd);
				this.$navNextBtn.prop("disabled", !canNavigateFwd);
				this.$navLastBtn.prop("disabled", !canNavigateFwd);

				var hasElementRef = this.model.get("radioNetworkAvailable") &&
									result !== null &&
									result.has("primaryCellId") &&
									!isNaN(result.get("primaryCellId"));

				this.$lookupElementBtn.prop("disabled", !hasElementRef);
				this.$lookupElementBtn.toggleClass("hidden", !hasElementRef);

				this.$tbResultsToolbar.toggleClass("hidden", result === null);
			}
		});

		return InfoView;
	}
);
