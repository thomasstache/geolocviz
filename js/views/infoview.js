define(
	["jquery", "underscore", "backbone",
	 "models/AccuracyResult", "models/LocationCandidate",
	 "types/resultsfilterquery", "types/googlemapsutils",
	 "hbs!templates/sessioninfo", "hbs!templates/resultinfo",
	 "hbs!templates/statisticsinfo", "hbs!templates/siteinfo"],

	function($, _, Backbone,
			 AccuracyResult, LocationCandidate, ResultsFilterQuery, GoogleMapsUtils,
			 sessionTemplate, resultTemplate, statisticsTemplate, siteTemplate) {

		/**
		 * Info View.
		 * Emits the following events:
		 *   session:focussed
		 *   session:unfocussed
		 *   session:listAll
		 *   result:nav-first
		 *   result:nav-prev
		 *   result:nav-next
		 *   result:nav-last
		 *   result:lookupElement
		 *   result:filterByElement
		 */
		var InfoView = Backbone.View.extend({
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
				"click .filterByElement" : "onFilterByElementClicked",
				"click .filterByRefcell" : "onFilterByElementClicked",
				"click .listAllSessions" : "onListAllSessionsClicked",
			},

			/** @type {AppState} the shared app state */
			model: null,

			initialize: function() {

				this.model.on("change:selectedSession", this.onSessionChanged, this);
				this.model.on("change:selectedResult", this.onResultChanged, this);
				this.model.on("change:selectedSite", this.onSiteChanged, this);
				this.model.on("change:focussedSessionId", this.updateSessionControls, this);
				this.model.on("change:radioNetworkAvailable", this.updateResultsControls, this);
				this.model.on("change:resultsAvailable", this.renderSiteInfo, this);
				this.model.on("change:elementSearchQuery", this.onSiteChanged, this);
				// indicates new Statistics model
				this.model.on("change:statistics", this.onStatisticsRefChanged, this);

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
			},

			onSessionChanged: function() {

				this.updateSessionControls();
				this.renderSessionInfo();
			},

			onResultChanged: function() {

				this.updateResultsControls();
				this.renderResultInfo();
			},

			onSiteChanged: function() {

				this.renderSiteInfo();
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
				if (session &&
					session.results) {

					if (context.resultCount > 0) {
						// calculate mean indoor probability
						var probIndoorSum = session.results.reduce(sumIndoorProbabilities, 0);
						context.probIndoor = probIndoorSum / context.resultCount;
						var confidenceSum = session.results.reduce(sumConfidence, 0);
						context.confidence = confidenceSum / context.resultCount;

						// calculate distance, duration and speed
						var distance_m = computeDistance(session.results, false);
						context.distance = Math.round(distance_m);

						var firstResult = session.results.first();

						// the mobility probability is constant for the whole session, take it from the first result
						if (firstResult instanceof AccuracyResult) {
							// for AccuracyResults we can compute the distance between all reference locations
							context.refDistance = Math.round(computeDistance(session.results, true));

							context.probMobility = firstResult.getBestLocationCandidate().get("probMobility");
						}
						else {
							context.probMobility = firstResult.get("probMobility");
						}

						// some files have no timestamp
						if (firstResult.has("timestamp")) {

							var lastResult = session.results.last(),
								duration_ms = lastResult.get("timestamp") - firstResult.get("timestamp");

							context.duration = duration_ms;

							if (duration_ms > 0.0) {
								var meanSpeed_m_s = distance_m / (duration_ms / 1000.0);
								context.meanSpeed = Math.round(meanSpeed_m_s * 3.6 * 10.0) / 10.0;
							}
						}
					}
				}

				this.$("#sessionInfo").html(sessionTemplate(context));
				return this;
			},

			// Render the result template.
			renderResultInfo: function() {

				var result = this.model.get("selectedResult");
				var context = result !== null ? result.getInfo() : {};
				if (result instanceof AccuracyResult) {
					context.isAccuracyResult = true;
				}
				if (result instanceof LocationCandidate) {
					context.isCandidate = true;
				}

				this.$("#resultInfo").html(resultTemplate(context));
				return this;
			},

			// Render the site template
			renderSiteInfo: function() {

				var site = this.model.get("selectedSite");
				var context = site !== null ? site.getInfo() : {};

				// decorate sectors according to celltype
				if (context.sectors && context.sectors.length > 0) {
					_.each(context.sectors, function(sector) {
						sector.isSmall = sector.cellType == 1;
						sector.isIndoor = sector.cellType == 2;
					});
				}

				// highlight sectors according to current lookup query
				if (context.sectors &&
				    this.model.has("elementSearchQuery")) {
					var query = this.model.get("elementSearchQuery");
					// TODO: check for query.elementType === "sector"
					var sectorProps = query.properties || {};

					var matching = _.where(context.sectors, sectorProps);
					if (matching && matching.length > 0) {

						_.each(matching, function(sector) {sector.highlight = true;});
					}
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

				this.$("#statistics").html(statisticsTemplate(context));
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
				this.trigger("result:" + eventType, this.model.get("selectedResult"));
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

			triggerCellLookup: function(useRefCell) {

				var result = this.model.get("selectedResult");
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

					var query = {
						elementType: "sector",
						properties: params
					};
					this.trigger("result:lookupElement", query);
				}
			},

			/**
			 * Handler for clicks on sector item filter buttons. Triggers a "result:filterByElement" event with the sectors CI.
			 * @param  {Event} evt jQuery click event
			 */
			onFilterByElementClicked: function(evt) {

				if (!(evt.currentTarget && evt.currentTarget.classList.contains("filterButton")))
					return;

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

				var result = this.model.get("selectedResult");

				var canNavigateBwd = result !== null && result.hasPrevious();
				var canNavigateFwd = result !== null && result.hasNext();

				this.$navFirstBtn.prop("disabled", !canNavigateBwd);
				this.$navPrevBtn.prop("disabled", !canNavigateBwd);
				this.$navNextBtn.prop("disabled", !canNavigateFwd);
				this.$navLastBtn.prop("disabled", !canNavigateFwd);

				var sectorProps = result !== null ? result.getSectorProperties() : {};
				var hasPrimaryCell = this.model.get("radioNetworkAvailable") &&
									sectorProps.primaryCellId !== undefined &&
									!isNaN(sectorProps.primaryCellId);
				var hasRefCell = this.model.get("radioNetworkAvailable") &&
								 sectorProps.referenceCellId !== undefined &&
								 !isNaN(sectorProps.referenceCellId);

				this.$lookupCellBtn.prop("disabled", !hasPrimaryCell);
				this.$lookupCellBtn.toggleClass("hidden", !hasPrimaryCell);
				this.$lookupRefCellBtn.prop("disabled", !hasRefCell);
				this.$lookupRefCellBtn.toggleClass("hidden", !hasRefCell);

				this.$tbResultsToolbar.toggleClass("hidden", result === null);
			}
		});

		/**
		 * Aggregator function for _.reduce() collecting the indoor probabilities of all results.
		 * @param  {Number} sum        The map/reduce memo value
		 * @param  {BaseResult} result The result model
		 * @return {Number}            New aggregation result
		 */
		function sumIndoorProbabilities(sum, result) {
			var data = result.getInfo(),
				prob = data.probIndoor || 0.0;
			return sum + prob;
		}

		/**
		 * Aggregator function for _.reduce() collecting the confidence of all results.
		 * @param  {Number} sum        The map/reduce memo value
		 * @param  {BaseResult} result The result model
		 * @return {Number}            New aggregation result
		 */
		function sumConfidence(sum, result) {
			var data = result.getInfo(),
				conf = data.confidence || 0.0;
			return sum + conf;
		}

		/**
		 * Calculate the length of the path between all geolocated positions.
		 * @param  {ResultList} results
		 * @return {Number}
		 */
		function computeDistance(results, useRefLocation) {
			var locations = [];
			results.each(function(result) {
				var pos = useRefLocation ? result.getRefPosition()
										 : result.getGeoPosition();
				GoogleMapsUtils.pushIfNew(locations, GoogleMapsUtils.makeLatLng(pos));
			});
			return GoogleMapsUtils.computeSphericDistance(locations);
		}

		return InfoView;
	}
);
