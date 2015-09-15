// configuration of jshint linting
/* global Modernizr: false, Notification: false */

define(

	["jquery", "underscore", "backbone",
	 "views/mapview", "views/settingsview", "views/legendview", "views/infoview", "views/filterview",
	 "views/searchview", "views/labelView", "views/filerepositoryview", "views/sessiontableview", "views/resulttableview",
	 "views/downloaddialog",
	 "collections/sessions", "collections/sites", "models/settings", "models/appstate", "models/statistics",
	 "types/searchquery", "types/elementfilterquery", "FileLoader", "filewriter", "types/logger"],

	function($, _, Backbone,
			 MapView, SettingsView, LegendView, InfoView, FilterView, SearchView, LabelView, FileRepositoryView,
			 SessionTableView, ResultTableView, DownloadDialog,
			 SessionList, SiteList, Settings, AppState, Statistics,
			 SearchQuery, ElementFilterQuery, FileLoader, FileWriter, Logger) {

		var PREFIX_CHANNELSEARCH = "ch:";

		var AppView = Backbone.View.extend({

			constructor: function AppView() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			el: $("#playground-app"),

			events: {
				"change #fileInput"      : "fileInputChanged",
				"click #cmdClearAllData" : "clearData",
				"click #cmdClearResults" : "clearResults",
				"click #cmdDownloadAxf"  : "downloadResults",
				"click #toggleResultsEditMode" : "toggleResultsEditMode",
				"click #dropCancel"      : "hideDropZone",
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

			// all our views
			settingsview: null,
			mapview: null,
			infoview: null,
			legendview: null,
			filterview: null,
			searchview: null,
			labelview: null,
			filerepositoryview: null,
			sessiontableview: null,
			resulttableview: null,
			downloadDialog: null,

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
				this.listenTo(this.model, "change:resultsEdited", this.onResultsEdited);
				this.sessions.on("add", this.sessionsUpdated, this);
				this.siteList.on("add", this.networkUpdated, this);

				// setup settings
				this.settings = new Settings();
				this.settingsview = new SettingsView({ model: this.settings, appstate: this.model });

				this.infoview = new InfoView({ model: this.model });
				this.filterview = new FilterView({ model: this.model });
				this.searchview = new SearchView();
				this.labelview = new LabelView();

				this.filerepositoryview = new FileRepositoryView();
				this.filerepositoryview.on("repository:fileselected", this.repositoryFileSelected, this);

				// setup map
				this.mapview = new MapView({
					collection: this.sessions,
					siteList: this.siteList,
					settings: this.settings,
					appstate: this.model,
				});

				this.legendview = new LegendView({ settings: this.settings, appstate: this.model });

				this.listenTo(this.mapview, "session:selected", this.sessionSelected);
				this.listenTo(this.mapview, "result:selected", this.resultSelected);
				this.listenTo(this.mapview, "results:filtered", this.resultsFiltered);
				this.listenTo(this.mapview, "site:selected", this.siteSelected);

				this.listenTo(this.infoview, "session:focussed", this.sessionFocussed);
				this.listenTo(this.infoview, "session:unfocussed", this.sessionUnfocussed);
				this.listenTo(this.infoview, "session:unselected", this.clearSelections);
				this.listenTo(this.infoview, "session:listAll", this.showSessionTable);
				this.listenTo(this.infoview, "result:listAll", this.showResultTable);
				this.listenTo(this.infoview, "result:nav-first", this.resultsNavigateToFirst);
				this.listenTo(this.infoview, "result:nav-prev", this.resultsNavigateToPrevious);
				this.listenTo(this.infoview, "result:nav-next", this.resultsNavigateToNext);
				this.listenTo(this.infoview, "result:nav-last", this.resultsNavigateToLast);
				this.listenTo(this.infoview, "result:revertPosition", this.resultsRevertPosition);
				this.listenTo(this.infoview, "result:lookupElement", this.resultsLookupElement);
				this.listenTo(this.infoview, "result:filterByElement", this.resultsFilterByElement);
				this.listenTo(this.infoview, "site:focus", this.focusSelectedSite);
				this.listenTo(this.infoview, "site:unselected", this.clearNetworkSelections);

				this.listenTo(this.filterview, "results:clear-filter", this.resultsClearFilter);
				this.listenTo(this.searchview, "search", this.searchHandler);

				$("#fileInput").prop("disabled", false);
			},

			/**
			 * Clears results data and related state and statistics.
			 */
			clearResults: function() {

				// update app state (selections et al)
				this.model.resetResultsData();
				this.clearFileForm();
				this.showFileDownloadView(false);
				this.enableEditModeControls(false);

				// update statistics
				if (this.model.has("statistics")) {
					var stats = this.model.get("statistics");
					stats.removeFileStatsForType([FileLoader.FileTypes.ACCURACY, FileLoader.FileTypes.AXF]);
				}

				this.sessions.reset();
				this.mapview.zoomToBounds();
			},

			/**
			 * Clears all data.
			 */
			clearData: function() {

				this.model.set("busy", true);

				this.sessions.reset();
				this.siteList.reset();

				// revert all attributes to defaults
				this.model.set(this.model.defaults);

				this.searchview.clearSearchField();
				this.clearFileForm();
				this.showFileDownloadView(false);
				this.enableEditModeControls(false);

				this.model.set("busy", false);
			},

			toggleResultsEditMode: function() {
				var oldMode = this.model.get("resultsEditMode");
				this.model.set("resultsEditMode", !oldMode);

				this.$("#toggleResultsEditMode").toggleClass("active");
			},

			/**
			 * Enable the download button.
			 */
			onResultsEdited: function(event) {

				var enableDownload = event.changed.resultsEdited;
				this.showFileDownloadView(enableDownload);
				this.$("#cmdDownloadAxf").prop("disabled", enableDownload === false);
			},

			/**
			 * Generate a result file and offer it for download.
			 */
			downloadResults: function() {

				// generate file contents
				var url = FileWriter.createAxfFileAsURL(this.sessions);

				if (url !== undefined && url !== null) {

					var stats = this.model.get("statistics"),
						axffiles = stats.getFileStatsForType(FileLoader.FileTypes.AXF);

					var fileName = (axffiles.length === 1) ? axffiles[0].name : "result.axf";

					// show the link
					var dialog = new DownloadDialog({
						url: url,
						filename: fileName,
					});
					this.listenToOnce(dialog, "dialog:cancel", this.onDownloadDialogClosed);
					this.downloadDialog = dialog;
				}
			},

			/** remove all listeners from the dialog */
			onDownloadDialogClosed: function() {
				this.stopListening(this.downloadDialog);
				this.downloadDialog = null;
			},

			// reset the form to clear old file names
			clearFileForm: function() {
				$("#fileForm")[0].reset();
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

			// Handler for the FileRepositoryViews "repository:fileselected" event.
			repositoryFileSelected: function(filename) {

				this.model.set("busy", true);
				FileLoader.loadFileFromRepository(filename, this.sessions, this.siteList, this.fileLoaded.bind(this), this.loadComplete.bind(this));
			},

			/**
			 * Load files from FileList.
			 * @param  {FileList} files
			 */
			loadFiles: function(files) {

				if (!files.length) {
					return;
				}

				this.model.set("busy", true);
				FileLoader.loadFiles(files, this.sessions, this.siteList, this.fileLoaded.bind(this), this.loadComplete.bind(this));
			},

			// Called when all files have been loaded. Triggers marker rendering.
			loadComplete: function() {

				if (this.model.get("sessionsDirty") === true) {

					this.mapview.drawResults();

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

				var log = Logger.getLogger(),
					messages = log.getMessages();
				if (messages.length > 0) {
					this.showNotification(messages.join('\n'));
				}

				log.clearMessages();

				this.model.set("busy", false);
			},

			// Callback for FileLoader
			fileLoaded: function(success, filestats) {

				if (!success)
					return;

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
					});
				}
				else if (filestats.type === FileLoader.FileTypes.AXF) {

					if (filestats.referenceCellsAvailable)
						this.model.set("resultsReferenceCellsAvailable", true);

					this.enableEditModeControls(true);
				}

				stats.trigger("change");
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

			// Show/hide file download controls.
			showFileDownloadView: function(show) {

				this.$("#cmdDownloadAxf").toggleClass("hidden", show === false);
			},

			// Enable/disable results edit controls.
			enableEditModeControls: function(enable) {

				var el = this.$("#toggleResultsEditMode");

				if (!enable)
					el.removeClass("active");

				el.prop("disabled", !enable);
			},

			dropHandler: function (evt) {
				evt.stopPropagation();
				evt.preventDefault();

				var dt = evt.originalEvent.dataTransfer;

				this.hideDropZone();

				if (dt.files && dt.files.length > 0) {

					// reset the form to clear old file names
					this.clearFileForm();

					this.loadFiles(dt.files);
				}
			},

			/**
			 * Show a desktop notification.
			 * @param  {String} message
			 */
			showNotification: function(message) {

				var view = this;
				if (Notification && Notification.permission) {
					// WhatWG spec notifications available

					if (Notification.permission === PERMISSION_GRANTED) {
						this._showHTML5Notification(message);
					}
					else {
						Notification.requestPermission(function(result) {
							if (result === PERMISSION_GRANTED) {
								view._showHTML5Notification(message);
							}
							else {
								alert(message);
							}
						});
					}
				}
				else if (window.webkitNotifications) {
					// Chrome notifications available

					if (window.webkitNotifications.checkPermission() === 0) { // 0 is PERMISSION_ALLOWED
						this._showWebkitNotification(message);
					} else {
						window.webkitNotifications.requestPermission(function() {
							view._showWebkitNotification(message);
						});
					}
				}
				else  {
					alert(message);
				}
			},

			/**
			 * Show a HTML5/WhatWG desktop notification (Firefox 22+).
			 * @param  {String} message
			 */
			_showHTML5Notification: function(message) {

				if (!(Notification && Notification.permission))
					return;

				// if permission denied, simply show Alert
				if (Notification.permission !== PERMISSION_GRANTED) {
					alert(message);
					return;
				}

				var notification = new Notification(
					"GeoLocViz",
					{
						body: message,
						icon: "images/map-96.png",
						tag: message,
					});

				// close notification automatically
				notification.onshow = function() {
					setTimeout(function() {
						notification.close();
					}, NOTIFICATION_TIMEOUT);
				};
			},

			/**
			 * Show a Webkit desktop notification (Google Chrome).
			 * @param  {String} message
			 */
			_showWebkitNotification: function(message) {

				if (!window.webkitNotifications)
					return;

				var notification = window.webkitNotifications.createNotification("images/map-96.png", "GeoLocViz", message);

				notification.show();

				// cancel notification automatically
				setTimeout(function() {
						notification.cancel();
					}, NOTIFICATION_TIMEOUT);
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

			/**
			 * Handler for "search" event from the search view.
			 * @param  {SearchQuery} query
			 */
			searchHandler: function(query) {

				switch (query.topic) {
					case SearchQuery.TOPIC_SESSION:
						var session = this.sessions.findSession(query.searchterm);
						if (session) {
							this.sessionSelected(session);
							this.sessionFocussed(session);
							// select first result of session
							if (session.results.length > 0) {
								var firstResult = session.results.first();
								this.resultSelected(firstResult);
							}
						}
						else {
							this.clearSelections();
							this.showNotification("No session with this ID...");
						}
						break;

					case SearchQuery.TOPIC_NETWORK:
						this.handleNetworkSearchRequest(query);
						break;

					case SearchQuery.TOPIC_RESULT:
						var searchresult = this.sessions.findResult(parseInt(query.searchterm, 10));
						this.sessionSelected(searchresult.session);
						this.resultSelected(searchresult.result);
						if (searchresult.result === null)
							this.showNotification("No message with this ID...");
						break;
				}
			},

			/**
			 * Handler for searches with the TOPIC_NETWORK topic.
			 * @param  {SearchQuery} query
			 */
			handleNetworkSearchRequest: function(query) {

				var searchterm = query.searchterm;

				if (searchterm.indexOf(PREFIX_CHANNELSEARCH) === 0) {
					// highlight sectors with the channelNumber
					var channelNumber = parseInt(searchterm.slice(PREFIX_CHANNELSEARCH.length), 10),
						props = { channelNumber: channelNumber };

					this.model.set('sectorHighlightQuery', new ElementFilterQuery(ElementFilterQuery.ELEMENT_SECTOR, props));
				}
				else {
					// look for ID matches in sites/sectors
					var site = this.siteList.findWhere({ name: searchterm }) ||
							   this.siteList.findSiteWithSector({ name: searchterm });

					this.siteSelected(site);
					if (site === null)
						this.showNotification("No network element with this name...");
				}
			},

			/*********************** Selection Handling ***********************/

			// Handler for "session:selected" event. Update the info display and highlight session on map.
			sessionSelected: function(session) {

				this.model.set("selectedSession", session);
			},

			// Handler for "result:selected" event. Update the info display and highlight result on map.
			resultSelected: function(result) {

				this.model.set("selectedResult", result);
			},

			// Handler for "session:unselected" event. Unselect session and results.
			clearSelections: function() {

				this.sessionSelected(null);
				this.sessionUnfocussed();
				// ensure previous selection (likely from other session) is reset
				this.resultSelected(null);
			},

			/**
			 * Handler for the MapView's "results:filtered" (a filter is active) event.
			 * @param  {ResultsFilterQuery} query The filter parameters
			 */
			resultsFiltered: function(query) {

				this.model.set({
					resultsFilterActive: true,
					resultsFilterQuery: query,
					focussedSessionId: -1
				});
			},

			// Handler for the FilterView's "results:clear-filter" event.
			resultsClearFilter: function() {

				this.model.set({
					resultsFilterActive: false,
					resultsFilterQuery: null
				});
				this.mapview.clearAllResultFilters();
			},

			// Handler for "session:focussed" event. Zoom the map view.
			sessionFocussed: function(session) {

				this.model.set("focussedSessionId", session.id);
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
			},

			// Handler for "site:focus" event. Focus map on the selected site.
			focusSelectedSite: function() {
				var site = this.model.get('selectedSite');
				this.mapview.zoomToSite(site);
			},

			// Handler for "site:unselected" event. Unselect sites and sectors.
			clearNetworkSelections: function() {

				this.siteSelected(null);
			},


			/*********************** Result Interaction ***********************/

			/**
			 * Handler for "result:lookupElement" event. Lookup site/sector
			 * @param  {ElementFilterQuery} query
			 */
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

						this.showNotification(message);
					}
				}
			},

			/**
			 * Handler for the "result:filterByElement" event from the InfoView.
			 * @param  {ResultsFilterQuery} query The filter parameters
			 */
			resultsFilterByElement: function(query) {

				if (query.cellIdentity !== undefined &&
				    query.netSegment !== undefined) {

					this.mapview.filterResultsBySector(query);
				}
			},

			/**
			 * Handler for "result:revertPosition" event. Lookup site/sector
			 * @param  {AxfResult} result
			 */
			resultsRevertPosition: function(result) {

				if (result) {
					result.revertGeoPosition();
				}
			},

			/**
			 * Handler for the "session:listAll" event from the InfoView.
			 */
			showSessionTable: function() {

				var view = this;

				if (this.sessiontableview === null) {

					var dialog = new SessionTableView({
						sessions: this.sessions,
						selectedSession: this.model.get('selectedSession'),
					});

					this.listenTo(dialog, "search", this.searchHandler);
					this.listenToOnce(dialog, "dialog:cancel", function() {
						view.stopListening(dialog);
						view.sessiontableview = null;
					});

					this.sessiontableview = dialog;
				}
				else {
					// dialog is just hidden
					this.sessiontableview.reshow();
				}
			},

			/**
			 * Handler for the "result:listAll" event from the InfoView.
			 */
			showResultTable: function() {

				var view = this;

				if (this.resulttableview === null) {

					var dialog = new ResultTableView({
						session: this.model.get("selectedSession"),
						selectedResult: this.model.get('selectedResult'),
					});

					this.listenTo(dialog, "search", this.searchHandler);
					this.listenToOnce(dialog, "dialog:cancel", function() {
						view.stopListening(dialog);
						view.resulttableview = null;
					});

					this.resulttableview = dialog;
				}
				else {
					// dialog is just hidden
					this.resulttableview.setSession(this.model.get("selectedSession"));
					this.resulttableview.reshow();
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

			/*********************** Misc events ***********************/

			// Handler for changes to the "busy" attribute in AppState. Updates the wait cursor.
			busyStateChanged: function(event) {

				$("html").toggleClass("wait", event.changed.busy);
			}
		});

		var OPT_SILENT = { silent: true };

		var PERMISSION_GRANTED = "granted";
		var NOTIFICATION_TIMEOUT = 5000;

		return AppView;
	}
);
