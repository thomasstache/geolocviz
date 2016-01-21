// jshint esnext:true
define(
	["jquery", "underscore", "backbone",
	 "models/AccuracyResult",
	 "types/resultsfilterquery", "types/elementfilterquery", "types/searchquery", "types/distinctcolormapper",
	 "hbs!templates/sessioninfo", "hbs!templates/resultinfo",
	 "hbs!templates/statisticsinfo", "hbs!templates/siteinfo",
	 "hbs!templates/highlightinfo"],

	function($, _, Backbone,
			 AccuracyResult, ResultsFilterQuery, ElementFilterQuery, SearchQuery, DistinctColorMapper,
			 sessionTemplate, resultTemplate, statisticsTemplate, siteTemplate, highlightsTemplate) {

		/**
		 * Info View.
		 * Emits the following events:
		 *   session:focussed
		 *   session:unfocussed
		 *   session:unselected
		 *   session:listAll
		 *   result:nav-first
		 *   result:nav-prev
		 *   result:nav-next
		 *   result:nav-last
		 *   result:lookupElement
		 *   result:revertPosition (Result model)
		 *   result:filterByElement
		 *   result:listAll
		 *   site:focus
		 *   site:unselected
		 *   network:clear-highlights
		 *   network:highlight-elements (SearchQuery)
		 */
		var InfoView = Backbone.View.extend({

			constructor: function InfoView() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			el: $("#infoView"),

			events: {
				"click .focus-session": "onFocusSessionClicked",
				"click .unfocus-session": "onUnfocusSessionClicked",
				"click .unselect-session": "onUnselectSessionClicked",
				"click .results-first": "onFirstResultClicked",
				"click .results-prev": "onPrevResultClicked",
				"click .results-next": "onNextResultClicked",
				"click .results-last": "onLastResultClicked",
				"click .lookup-cell": "onLookupCellClicked",
				"click .lookup-ref-cell": "onLookupRefCellClicked",
				"click .revert-position": "onRevertPositionClicked",
				"click .filterByElement": "onFilterByElementClicked",
				"click .filterByRefcell": "onFilterByElementClicked",
				"click .listAllSessions": "onListAllSessionsClicked",
				"click .listAllResults" : "onListAllResultsClicked",
				"click .focus-site"   : "onFocusSiteClicked",
				"click .unselect-site": "onUnselectSiteClicked",
				"click .highlight-element": "onHighlightElementClicked",
				"click .clear-highlights": "onClearSectorHighlightsClicked",
			},

			/** @type {AppState} the shared app state */
			model: null,

			/** @type {Settings} the app settings */
			settings: null,

			/** @type {BaseResult} the currently displayed result model */
			selectedResult: null,

			$tbSessionToolbar: null,
			$tbResultsToolbar: null,
			$focusBtn: null,
			$unfocusBtn: null,
			$navFirstBtn: null,
			$navPrevBtn: null,
			$navNextBtn: null,
			$navLastBtn: null,
			$lookupCellBtn: null,
			$lookupRefCellBtn: null,

			/** @type {Set} all channel numbers that were subsequently highlighted */
			highlightedChannelNumbers: null,

			colorMapper: null,

			initialize: function(options) {

				this.settings = options.settings;

				this.model.on("change:selectedSession", this.onSessionChanged, this);
				this.model.on("change:selectedResult", this.onResultChanged, this);
				this.model.on("change:selectedSite change:selectedSector", this.onSiteChanged, this);
				this.model.on("change:focussedSessionId", this.updateSessionControls, this);
				this.model.on("change:radioNetworkAvailable", this.updateResultsControls, this);
				this.model.on("change:resultsAvailable", this.renderSiteInfo, this);
				// indicates new Statistics model
				this.model.on("change:statistics", this.onStatisticsRefChanged, this);

				this.model.on("change:sectorHighlightQuery", this.onSectorHighlightChanged, this);

				this.$tbSessionToolbar = this.$(".toolbar.sessionControls");
				this.$tbResultsToolbar = this.$(".toolbar.resultControls");

				this.$focusBtn = this.$("button.focus-session");
				this.$unfocusBtn = this.$("button.unfocus-session");
				this.$navFirstBtn = this.$("button.results-first");
				this.$navPrevBtn = this.$("button.results-prev");
				this.$navNextBtn = this.$("button.results-next");
				this.$navLastBtn = this.$("button.results-last");

				this.$lookupCellBtn = this.$("button.lookup-cell");
				this.$lookupRefCellBtn = this.$("button.lookup-ref-cell");

				this.highlightedChannelNumbers = new Set();
			},

			initColorMapper: function() {

				if (this.colorMapper === null)
					this.colorMapper = new DistinctColorMapper();
			},

			onSessionChanged: function() {

				this.updateSessionControls();
				this.renderSessionInfo();
			},

			onResultChanged: function(event) {

				var result = event.changed.selectedResult;

				if (this.selectedResult !== result) {

					this.stopListening(this.selectedResult);
					this.selectedResult = result;

					if (result !== null)
						this.listenTo(this.selectedResult, "change:edited", this.onResultEdited);
				}

				this.updateResultsControls();
				this.renderResultInfo();
			},

			/**
			 * Handler for the "change:edited" event on the current result model.
			 */
			onResultEdited: function() {

				this.renderResultInfo();
			},

			/**
			 * Updates site block when the selected site changes.
			 */
			onSiteChanged: function() {

				this.renderSiteInfo();
			},

			/**
			 * Updates information about sector highlights.
			 */
			onSectorHighlightChanged: function(appstate) {

				/** @type {ElementFilterQuery} properties of elements being highlighted */
				var highlightQuery = appstate.changed.sectorHighlightQuery;
				if (highlightQuery === undefined)
					return; // attribute of interest didn't change

				var channelNumberSet = this.highlightedChannelNumbers;

				function addToChannelNumberSet(props) {

					if (props.channelNumber !== undefined)
						channelNumberSet.add(props.channelNumber);
				}

				if (highlightQuery === null) {
					channelNumberSet.clear();
				}
				else {
					var props = highlightQuery.properties;

					if (props instanceof Array) {

						props.forEach(function(query) {
							addToChannelNumberSet(query);
						});
					}
					else {
						addToChannelNumberSet(props);
					}
				}

				this.renderSectorHighlightInfo();
			},

			onStatisticsRefChanged: function(event) {

				if (event.changed.statistics !== undefined) {
					// the Statistics model reference has changed

					var oldStats = event.previous("statistics");
					if (oldStats)
						oldStats.off("change", this.renderStatistics);

					var newStats = event.changed.statistics;
					if (newStats)
						newStats.on("change", this.renderStatistics, this);

					this.renderStatistics();
				}
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

				var session = this.model.get("selectedSession");
				var context = session !== null ? session.getInfo() : {};

				this.$("#sessionInfo").html(sessionTemplate(context));
				return this;
			},

			// Render the result template.
			renderResultInfo: function() {

				var result = this.selectedResult;
				var context = result !== null ? result.getInfo() : {};

				this.$("#resultInfo").html(resultTemplate(context));
				return this;
			},

			// Render the site template
			renderSiteInfo: function() {

				var site = this.model.get("selectedSite");
				var context = site !== null ? site.getInfo() : {};

				var selectedSectorId = this.model.has("selectedSector")
									 ? this.model.get("selectedSector").id
									 : undefined;

				// decorate sectors according to celltype
				if (context.sectors && context.sectors.length > 0) {
					_.each(context.sectors, function(sector) {
						sector.isSmall = sector.cellType == 1;
						sector.isIndoor = sector.cellType == 2;

						// highlight the selected sector
						sector.highlight = sector.id === selectedSectorId;
					});
				}

				// enable filter buttons
				if (this.model.get("resultsAvailable")) {
					context.enableFilterPrimaryCells = true;
				}
				if (this.model.get("resultsReferenceCellsAvailable")) {
					context.enableFilterRefCells = true;
				}

				this.$("#siteInfo").html(siteTemplate(context));
				return this;
			},

			renderSectorHighlightInfo: function() {

				var context = {};

				if (this.highlightedChannelNumbers.size > 0) {
					var numArray = [];
					context.values = [];
					this.initColorMapper();

					this.highlightedChannelNumbers.forEach(function(num) {
						numArray.push(num);
					});

					numArray.sort(numcomparator);

					for (var num of numArray) {
						context.values.push({
							value: num,
							color: this.colorMapper.getColor(num),
						});
					}
				}

				this.$("#sectorHighlightInfo").html(highlightsTemplate(context));
				return this;
			},

			// Render the statistics template.
			renderStatistics: function() {

				var stats = this.model.get("statistics");
				var context = stats !== null ? stats.toJSON() : {};

				// add some flags to be used in template
				if (context.numSites && context.numSites > 0)
					context.hasNetwork = true;

				if (stats !== null && stats.has("numResultsAfterFilter")) {
					context.resultsFiltered = true;
					context.confidenceThreshold = this.settings.get("confidenceThreshold");
				}

				this.$("#statistics").html(statisticsTemplate(context));
				return this;
			},

			/**
			 * Click handler for the "focus session" button. Trigger "focus" event.
			 */
			onFocusSessionClicked: function() {

				this.trigger("session:focus");
			},

			/**
			 * Click handler for the "done" button. Trigger "unfocus" event.
			 */
			onUnfocusSessionClicked: function() {

				this.trigger("session:unfocussed");
			},

			/**
			 * Click handler for the "X" button. Unselect session.
			 */
			onUnselectSessionClicked: function() {

				this.trigger("session:unselected");
			},

			/**
			 * Handler for clicks on "List All Sessions" button. Triggers a "session:listAll" event.
			 */
			onListAllSessionsClicked: function() {

				this.trigger("session:listAll");
			},

			/**
			 * Handler for clicks on "List All Sessions" button. Triggers a "session:listAll" event.
			 */
			onListAllResultsClicked: function() {

				this.trigger("result:listAll");
			},

			updateSessionControls: function() {

				var session = this.model.get("selectedSession");
				var focussedSessionId = this.model.get("focussedSessionId");
				var canFocus = session !== null;

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
				this.trigger("result:" + eventType, this.selectedResult);
			},

			/**
			 * Click handler for the "Focus site" button.
			 */
			onFocusSiteClicked: function() {
				this.trigger("site:focus");
			},

			/**
			 * Click handler for the "(/)" button. Unselect site.
			 */
			onUnselectSiteClicked: function() {
				this.trigger("site:unselected");
			},

			/**
			 * Clear highlight of sectors with certain properties.
			 */
			onClearSectorHighlightsClicked: function() {
				this.trigger("network:clear-highlights");
			},

			/**
			 * Click handler for the "lookup primary cell" button.
			 * If the result has a cell reference, the "result:lookupElement" event is triggered.
			 * The event payload is an object containing primaryCellId and controllerId.
			 */
			onLookupCellClicked: function() {
				this.triggerCellLookup(false);
			},

			/**
			 * Click handler for the "lookup reference cell" button.
			 * If the result has a cell reference, the "result:lookupElement" event is triggered.
			 * The event payload is an object containing referenceCellId and refControllerId.
			 */
			onLookupRefCellClicked: function() {
				this.triggerCellLookup(true);
			},

			/**
			 * Click handler for the "revert result position" button.
			 */
			onRevertPositionClicked: function() {
				this.trigger("result:revertPosition", this.selectedResult);
			},

			triggerCellLookup: function(useRefCell) {

				var result = this.selectedResult;
				var sectorProps = result.getSectorProperties();

				var params = null;
				if (useRefCell) {
					// use reference cell data
					if (!isNaN(sectorProps.referenceCellId) && !isNaN(sectorProps.refControllerId))
						params = {
							cellIdentity: sectorProps.referenceCellId,
							netSegment: sectorProps.refControllerId
						};
				}
				else {
					// use primary cell data
					if (!isNaN(sectorProps.primaryCellId) && !isNaN(sectorProps.controllerId)) {
						params = {
							cellIdentity: sectorProps.primaryCellId,
							netSegment: sectorProps.controllerId
						};
					}
				}

				if (params) {

					var query = new ElementFilterQuery(ElementFilterQuery.ELEMENT_SECTOR, params);
					this.trigger("result:lookupElement", query);
				}
			},

			/**
			 * Handler for clicks on sectors' highlight channel buttons. Triggers a "network:highlight-elements" event.
			 * @param  {Event} evt jQuery click event
			 */
			onHighlightElementClicked: function(evt) {

				var el = evt.currentTarget;

				if (el.dataset &&
					el.dataset.channel !== undefined) {

					var searchQuery = new SearchQuery(
						SearchQuery.TOPIC_CHANNELNUMBER,
						el.dataset.channel
					);
					this.trigger("network:highlight-elements", searchQuery);
				}
			},

			/**
			 * Handler for clicks on sector item filter buttons. Triggers a "result:filterByElement" event with the sectors CI.
			 * @param  {Event} evt jQuery click event
			 */
			onFilterByElementClicked: function(evt) {

				var el = evt.currentTarget;

				var topic;
				if (el.classList.contains("filterByElement"))
					topic = ResultsFilterQuery.TOPIC_PRIMARYCELL;
				else if (el.classList.contains("filterByRefcell"))
					topic = ResultsFilterQuery.TOPIC_REFERENCECELL;

				if (el.dataset &&
					el.dataset.ci !== undefined &&
					el.dataset.netsegment !== undefined) {

					var query = new ResultsFilterQuery(
						topic,
						el.dataset.sector,
						parseInt(el.dataset.netsegment, 10),
						parseInt(el.dataset.ci, 10)
					);
					this.trigger("result:filterByElement", query);
				}
			},

			/* Updates toolbar button (enabled/visibility) states on result change. */
			updateResultsControls: function() {

				var result = this.selectedResult;

				var canNavigateBwd = result !== null && result.hasPrevious();
				var canNavigateFwd = result !== null && result.hasNext();

				this.$navFirstBtn.prop("disabled", !canNavigateBwd);
				this.$navPrevBtn.prop("disabled", !canNavigateBwd);
				this.$navNextBtn.prop("disabled", !canNavigateFwd);
				this.$navLastBtn.prop("disabled", !canNavigateFwd);

				var sectorProps = result !== null ? result.getSectorProperties() : {};
				var hasPrimaryCell = this.model.get("radioNetworkAvailable")
								   && isValidCellId(sectorProps.primaryCellId);
				var hasRefCell = this.model.get("radioNetworkAvailable")
							   && isValidCellId(sectorProps.referenceCellId);

				this.$lookupCellBtn.prop("disabled", !hasPrimaryCell);
				this.$lookupCellBtn.toggleClass("hidden", !hasPrimaryCell);
				this.$lookupRefCellBtn.prop("disabled", !hasRefCell);
				this.$lookupRefCellBtn.toggleClass("hidden", !hasRefCell);

				this.$tbResultsToolbar.toggleClass("hidden", result === null);
			}
		});

		function isValidCellId(cellId) {
			return cellId !== undefined && cellId !== null
					&& !isNaN(cellId) && cellId !== -1;
		}

		function numcomparator(a, b) {
			if (a === b)
				return 0;

			return a < b ? -1 : 1;
		}

		return InfoView;
	}
);
