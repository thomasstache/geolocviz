define(
	["underscore", "backbone"],

	function(_, Backbone) {

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

			constructor: function Statistics() {
				Backbone.Model.prototype.constructor.apply(this, arguments);
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
				},
				OPT_SILENT);
			},

			addFileStats: function(filestats) {
				// willfully using '!=' to test against undefined and null
				/*jshint eqnull:true*/

				this.get("files").push(filestats);

				if (filestats.numResults != null)
					this.addTo("numResults", filestats.numResults);
				if (filestats.numResultsAndCandidates != null)
					this.addTo("numResultsAndCandidates", filestats.numResultsAndCandidates);
			},

			/**
			 * Removes all entries from the files array matching one of the given file types.
			 * @param  {Array} typeList List of types to remove.
			 * @return {void}
			 */
			removeFileStatsForType: function(typeList) {
				var types = typeList || [],
					obsolete = [],
					file, files = this.get("files");

				if (!types.length || !files.length)
					return;

				for (var i = 0; i < files.length; i++) {
					file = files[i];
					if (types.indexOf(file.type) >= 0)
						obsolete.push(file);
				}

				if (obsolete.length > 0)
					this.set("files", _.difference(files, obsolete));
			},

			/**
			 * Returns the FileStatistics matching the given type.
			 * @param  {FileType} type
			 * @return {Array}
			 */
			getFileStatsForType: function(type) {

				var files = this.get("files");

				return _.where(files, {type: type});
			},

			addTo: function(attribute, value) {
				if (this.has(attribute)) {
					var current = this.get(attribute);
					this.set(attribute, current + value, OPT_SILENT);
				}
			}
		});

		var OPT_SILENT = Object.freeze({ silent: true });

		return Statistics;
	}
);
