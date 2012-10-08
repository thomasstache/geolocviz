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
				numResultsAndCandidates: 0
			},

			initialize: function() {
				this.set("files", []);
			},

			addFileStats: function(filestats) {
				this.get("files").push(filestats);
				this.addTo("numRows", filestats.numRows);
				this.addTo("numResults", filestats.numResults);
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
