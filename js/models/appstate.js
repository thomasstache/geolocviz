define(
	["backbone"],

	function(Backbone) {

		var AppState = Backbone.Model.extend({

			defaults: {
				// if the app is busy/waiting
				busy: false,

				// if the session list was updated and needs redraw
				sessionsDirty: false,
				// if the network was updated and needs redraw
				radioNetworkDirty: false,

				// if radio network data was loaded
				radioNetworkAvailable: false,
				// if result data was loaded
				resultsAvailable: false,
				// if result data with reference cells was loaded
				resultsReferenceCellsAvailable: false,

				// if there are AccuracyResults
				referenceLocationsAvailable: false,
				// if there are LocationCandidates
				candidateLocationsAvailable: false,

				// if the results are currently filtered
				resultsFilterActive: false,
				// last result query (after results:filtered)
				resultsFilterQuery: null,

				// last element query (after results:lookupElement)
				elementSearchQuery: null,

				// the model of the selected/active session
				selectedSession: null,

				// the model of the selected result/sample
				selectedResult: null,

				// the model of the selected site
				selectedSite: null,

				// id of the last focussed session
				focussedSessionId: -1,

				/** @type {ColorMapper} reference to the ColorMapper for the currently selected attribute */
				markerColorMapper: null,

				/** @type {Statistics} model containing statistics about loaded files and records */
				statistics: null
			},

			/**
			 * Reset the attributes corresponding to results data to their defaults.
			 */
			resetResultsData: function() {
				this.set({
					resultsAvailable: false,
					resultsReferenceCellsAvailable: false,
					referenceLocationsAvailable: false,
					candidateLocationsAvailable: false,
					resultsFilterActive: false,
					resultsFilterQuery: null,
					elementSearchQuery: null,
					selectedSession: null,
					selectedResult: null,
					focussedSessionId: -1,
				});

				if (this.has("statistics")) {
					var stats = this.get("statistics");
					stats.resetResultsData();
				}
			}
		});

		return AppState;
	}
);
