// jshint
/*global Modernizr: true */

define(

	["jquery", "underscore", "backbone",
	 "views/mapview", "views/settingsview", "views/legendview", "views/infoview", "views/filterview",
	 "collections/sessions", "collections/sites", "models/settings", "models/appstate", "models/statistics", "FileLoader"],

	function($, _, Backbone,
			 MapView, SettingsView, LegendView, InfoView, FilterView,
			 SessionList, SiteList, Settings, AppState, Statistics, FileLoader) {

		var AppView = Backbone.View.extend({
			el: $("#playground-app"),

			events: {
				"change #fileInput"      : "fileInputChanged",
				"change #searchInput"    : "searchInputChanged",
				"click #cmdClearAllData" : "clearData",
				"click #cmdClearResults" : "clearResults",
				"drop #fileDropZone"     : "dropHandler"
			},

			/** @type {AppState} model containing shared application state, like selection state or statistics */
			model: null,

			/** @type {SessionList} session collection containing all result samples */
			sessions: null,

			/** @type {SiteList} the site collection forming our RAN model */
			siteList: null,

			/** @type {Settings} model for user controlable settings */
			settings: null,

			// the counter tracking file loads
			numFilesQueued: 0,

			initialize: function() {

				if (!this.checkFileAPIs()) {
					$("#mainToolbar").hide();
					$("#mapView").hide();
					return;
				}

				this.setupDragDrop();

				// init model
				this.model = new AppState();
				this.sessions = new SessionList();
				this.siteList = new SiteList();

				// listen to changes
				this.model.on("change:busy", this.busyStateChanged, this);
				this.sessions.on("all", this.render, this);
				this.sessions.on("add", this.sessionsUpdated, this);
				this.siteList.on("add", this.networkUpdated, this);

				// setup settings
				this.settings = new Settings();
				this.settingsview = new SettingsView({ model: this.settings, appstate: this.model });

				// setup map
				this.mapview = new MapView({
					collection: this.sessions,
					siteList: this.siteList,
					settings: this.settings
				});

				this.legendview = new LegendView({ settings: this.settings, appstate: this.model, colors: this.mapview.colors() });
				this.infoview = new InfoView({ model: this.model });
				this.filterview = new FilterView({ model: this.model });

				this.mapview.on("session:selected", this.sessionSelected, this);
				this.mapview.on("result:selected", this.resultSelected, this);
				this.mapview.on("results:filtered", this.resultsFiltered, this);
				this.mapview.on("site:selected", this.siteSelected, this);

				this.infoview.on("session:focussed", this.sessionFocussed, this);
				this.infoview.on("session:unfocussed", this.sessionUnfocussed, this);
				this.infoview.on("result:nav-first", this.resultsNavigateToFirst, this);
				this.infoview.on("result:nav-prev", this.resultsNavigateToPrevious, this);
				this.infoview.on("result:nav-next", this.resultsNavigateToNext, this);
				this.infoview.on("result:nav-last", this.resultsNavigateToLast, this);
				this.infoview.on("result:lookupElement", this.resultsLookupElement, this);
				this.infoview.on("result:filterByElement", this.resultsFilterByElement, this);

				this.filterview.on("results:clear-filter", this.resultsClearFilter, this);

				$("#fileInput").prop("disabled", false);
			},

			render: function() {

				if (this.sessions.length)
					this.legendview.$el.show();
				else
					this.legendview.$el.hide();
			},

			/**
			 * Clears results data and related state and statistics.
			 */
			clearResults: function() {

				// update app state (selections et al)
				this.model.resetResultsData();
				this.clearFileForm();

				// update statistics
				if (this.model.has("statistics")) {
					var stats = this.model.get("statistics");
					stats.removeFileStatsForType([FileLoader.FileTypes.ACCURACY, FileLoader.FileTypes.AXF]);
				}

				this.sessions.reset();
				this.mapview.updateBoundsToNetwork();
				this.mapview.zoomToBounds();
			},

			/**
			 * Clears all data.
			 */
			clearData: function() {

				this.sessions.reset();
				this.siteList.reset();

				// revert all attributes to defaults
				this.model.set(this.model.defaults);

				this.clearSearchField();
				this.clearFileForm();
			},

			// reset the form to clear old file names
			clearFileForm: function() {
				$("#fileForm")[0].reset();
			},
			clearSearchField: function() {
				$("#searchInput").prop("value", "");
			},

			// Check for the various File API support.
			checkFileAPIs: function() {

				if (Modernizr.filereader) {
					// Great success! All the File APIs are supported.
					return true;
				} else {
					alert('The File APIs are not fully supported in this browser. Consider using Mozilla Firefox (>8) or Google Chrome (>7)!');
					return false;
				}
			},

			// Handler for the "change" event of the file input. Kick of load process.
			fileInputChanged: function(evt) {

				var files = evt.target.files;
				this.loadFiles(files);
			},

			loadFiles: function(files) {

				if (!files.length) {
					return;
				}

				this.numFilesQueued += files.length;
				this.model.set("busy", true);
				FileLoader.loadFiles(files, this.sessions, this.siteList, this.fileLoaded.bind(this));
			},

			// Called when all files have been loaded. Triggers marker rendering.
			loadComplete: function() {
				this.model.set("busy", false);

				if (this.model.get("sessionsDirty") === true) {
					this.mapview.drawResultMarkers();
					this.model.set({
						sessionsDirty: false,
						resultsAvailable: this.sessions.length > 0
					});
				}
				if (this.model.get("radioNetworkDirty") === true) {
					this.mapview.drawNetwork();
					this.model.set({
						radioNetworkDirty: false,
						radioNetworkAvailable: this.siteList.length > 0,
					});
				}
			},

			// Callback for FileLoader
			fileLoaded: function(success, filestats) {

				if (!this.model.has("statistics"))
					this.model.set("statistics", new Statistics());

				var stats = this.model.get("statistics");
				stats.addFileStats(filestats);
				stats.set("numSessions", this.sessions.length, OPT_SILENT);

				if (filestats.type === FileLoader.FileTypes.CELLREF) {

					// count sectors
					var numSectors = this.siteList.reduce(function(memo, site) { return memo + site.getSectors().length; }, 0);
					stats.set({
						numSectors: numSectors,
						numSites: this.siteList.length,
					},
					OPT_SILENT);
				}
				else if (filestats.type === FileLoader.FileTypes.ACCURACY) {

					this.model.set({
						referenceLocationsAvailable: true,
						candidateLocationsAvailable: true,
					});
				}

				stats.trigger("change");

				this.numFilesQueued--;
				if (this.numFilesQueued === 0)
					this.loadComplete();
			},

			// set up file drag-and-drop event handlers
			setupDragDrop: function() {

				var view = this;

				// Set up the drop zone.
				$("#fileDropZone")

					// hide when mouse leaves the overlay (i.e. the window)
					.on("dragleave", function() {
						view.hideDropZone();
						return false;
					})
					// Allow drops of any kind into the zone.
					.on("dragover", function(evt) {
						evt.originalEvent.dataTransfer.dropEffect = "copy";
						return false;
					});

				$(document)
					// enable drop zone
					.on("dragenter", function(evt) {
						evt.stopPropagation();
						evt.preventDefault();
						view.showDropZone();
					})
					// prevent drop on body
					.on("dragover", function(evt) {
						evt.originalEvent.dataTransfer.dropEffect = "none";
						return false;
					});
			},

			// show drop zone
			showDropZone: function() {
				$("#fileDropVeil").fadeIn("fast");
			},
			hideDropZone: function() {
				$("#fileDropVeil").fadeOut("fast");
			},

			dropHandler: function (evt) {
				evt.stopPropagation();
				evt.preventDefault();

				var dt = evt.originalEvent.dataTransfer;
				var files = dt.files; // FileList object.

				this.hideDropZone();

				// reset the form to clear old file names
				this.clearFileForm();

				this.loadFiles(files);
			},

			/**
			 * Show a W3C desktop notification.
			 * @param  {String} message
			 */
			showNotification: function(message) {

				// currently only available on Webkit (see Mozilla Bug 594543)
				if (!window.webkitNotifications)
					return;

				var notification = window.webkitNotifications.createNotification("images/map-96.png", "GeoLocViz", message);

				notification.show();

				// cancel notification automatically
				setTimeout(function() {
						notification.cancel();
					}, 5000);
			},

			// Handler for the "add" event from the sessions collection.
			sessionsUpdated: function() {
				this.model.set("sessionsDirty", true);
			},

			// Handler for the "add" event from the sites collection.
			networkUpdated: function() {
				this.model.set("radioNetworkDirty", true);
			},

			/*********************** Search and Lookups ***********************/

			// Handler for "change" event from the search field.
			searchInputChanged: function(evt) {

				var searchText = evt.target.value;
				var session = this.sessions.get(searchText);
				if (session) {
					this.sessionSelected(session);
					this.sessionFocussed(session);
				}
				else {
					this.sessionSelected(null);
					this.sessionUnfocussed();
				}
				// check if it's a site/sector
				var site = this.siteList.get(searchText);
				if (site) {
					this.siteSelected(site);
				}
				else {
					this.siteSelected(null);
				}

				this.resultSelected(null);
			},

			/*********************** Selection Handling ***********************/

			// Handler for "session:selected" event. Update the info display.
			sessionSelected: function(session) {

				this.model.set("selectedSession", session);
				// connect session results
				this.mapview.drawSessionLines(session);
			},

			// Handler for "result:selected" event. Update the info display.
			resultSelected: function(result) {

				this.model.set("selectedResult", result);
				var view = this.mapview;
				// this timeout is necessary to make the result marker doubleclick work
				setTimeout(function(){
					view.highlightResult(result);
				}, 200);
			},

			// Handler for the MapView's "results:filtered" event.
			resultsFiltered: function() {

				this.model.set({
					resultsFilterActive: true,
					focussedSessionId: -1
				});
			},

			// Handler for the FilterView's "results:clear-filter" event.
			resultsClearFilter: function() {

				this.model.set("resultsFilterActive", false);
				this.mapview.clearAllResultFilters();
			},

			// Handler for "session:focussed" event. Zoom the map view.
			sessionFocussed: function(session) {

				this.model.set("focussedSessionId", session.id);
				this.mapview.focusSession(session);
			},

			// Handler for "session:unfocussed" event. Zoom the map view.
			sessionUnfocussed: function() {

				this.model.set("focussedSessionId", -1);
				this.mapview.zoomToBounds();
			},

			// Handler for the "site:selected" event from the mapview.
			siteSelected: function(site) {

				if (site === null)
					this.model.set("elementSearchQuery", null);

				this.model.set("selectedSite", site);
				this.mapview.highlightSite(site, true);
			},


			/*********************** Result Interaction ***********************/

			// Handler for "results:lookupElement" event. Lookup site/sector
			resultsLookupElement: function(query) {

				if (query.elementType === "sector") {

					var site = this.siteList.findSiteWithSector(query.properties);
					if (site) {
						// remember last query
						this.model.set("elementSearchQuery", query);

						this.siteSelected(site);
					}
					else {
						// site not found

						var message = "No matching site found...";

						if (window.webkitNotifications) {

							if (window.webkitNotifications.checkPermission() === 0) { // 0 is PERMISSION_ALLOWED
								this.showNotification(message);
							} else {
								var view = this;
								window.webkitNotifications.requestPermission(function() {
									view.showNotification(message);
								});
							}
						}
						else {
							alert(message);
						}
					}
				}
			},

			// Handler for the "result:filterByElement" event from the InfoView.
			resultsFilterByElement: function(query) {

				if (query.cellIdentity !== undefined &&
				    query.netSegment !== undefined) {

					this.mapview.filterResultsBySector(query);
				}
			},

			/*********************** Result Navigation ***********************/

			// Handler for "result:nav-first" event.
			resultsNavigateToFirst: function(result) {

				if (result &&
					result.hasPrevious()) {

					var newResult = result.collection.first();
					this.resultSelected(newResult);
				}
			},

			// Handler for "result:nav-next" event.
			resultsNavigateToNext: function(result) {

				if (result &&
					result.hasNext()) {

					var index = result.getIndex();
					var newResult = result.collection.at(index + 1);
					this.resultSelected(newResult);
				}
			},

			// Handler for "result:nav-prev" event.
			resultsNavigateToPrevious: function(result) {

				if (result &&
					result.hasPrevious()) {

					var index = result.getIndex();
					var newResult = result.collection.at(index - 1);
					this.resultSelected(newResult);
				}
			},

			// Handler for "result:nav-last" event.
			resultsNavigateToLast: function(result) {

				if (result &&
					result.hasNext()) {

					var newResult = result.collection.last();
					this.resultSelected(newResult);
				}
			},

			// Handler for changes to the "busy" attribute in AppState. Updates the wait cursor.
			busyStateChanged: function(event) {

				$("html").toggleClass("wait", event.changed.busy);
			}
		});

		var OPT_SILENT = Object.freeze({ silent: true });

		return AppView;
	}
);
