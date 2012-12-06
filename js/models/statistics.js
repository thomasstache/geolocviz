define(
	["backbone"],

	function(Backbone) {

		var Statistics = Backbone.Model.extend({

			defaults: {
				// list of per-file statistics
				files: [],
				// total number of sessions
				numSessions: 0,
				// total number of results ("best candidates" for .distances files)
				numResults: 0,
				// total number of results (including candidates)
				numResultsAndCandidates: 0,

				// number of loaded sites
				numSites: 0,
				// number of loaded sectors
				numSectors: 0,
			},

			initialize: function() {
				this.set("files", []);
			},

			/**
			 * Reset the attributes corresponding to results data to their defaults.
			 */
			resetResultsData: function() {
				this.set({
					numSessions: this.defaults.numSessions,
					numResults: this.defaults.numResults,
					numResultsAndCandidates: this.defaults.numResultsAndCandidates,
				});
				// TODO: comb through "files" array and remove result files
			},

			addFileStats: function(filestats) {
				this.get("files").push(filestats);

				// willfully using '!=' to test against undefined and null
				if (filestats.numResults != null)
					this.addTo("numResults", filestats.numResults);
				if (filestats.numResultsAndCandidates != null)
					this.addTo("numResultsAndCandidates", filestats.numResultsAndCandidates);
			},

			addTo: function(attribute, value) {
				if (this.has(attribute)) {
					var current = this.get(attribute);
					this.set(attribute, current + value);
				}
			}
		});

		return Statistics;
	}
);
