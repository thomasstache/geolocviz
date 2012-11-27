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
				// if there are AccuracyResults
				referenceLocationsAvailable: false,
				// if there are LocationCandidates
				candidateLocationsAvailable: false,

				// if the results are currently filtered
				resultsFilterActive: false,
				// the model of the selected/active session
				selectedSession: null,

				// the model of the selected result/sample
				selectedResult: null,

				// the model of the selected site
				selectedSite: null,

				// id of the last focussed session
				focussedSessionId: -1,

				/** @type {Statistics} model containing statistics about loaded files and records */
				statistics: null
			},
		});

		return AppState;
	}
);
