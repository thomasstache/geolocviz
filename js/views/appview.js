define(

	["jquery", "underscore", "backbone",
	 "views/mapview", "views/settingsview", "views/legendview", "views/infoview",
	 "collections/sessions", "models/settings", "models/appstate", "models/statistics", "FileLoader"],

	function($, _, Backbone,
			 MapView, SettingsView, LegendView, InfoView,
			 SessionList, Settings, AppState, Statistics, FileLoader) {

		var AppView = Backbone.View.extend({
			el: $("#playground-app"),

			events: {
				"change #fileInput": "loadFiles",
				"change #searchSessionInput": "searchSessionInputChanged"
			},

			model: null,

			sessions: null,

			settings: null,

			// the counter tracking file loads
			numFilesQueued: 0,

			initialize: function() {

				if (!this.checkFileAPIs()) {
					$("#mainToolbar").hide();
					$("#mapView").hide();
					return;
				}

				// init model
				this.model = new AppState();
				this.sessions = new SessionList();
				// listen to changes
				this.model.on("change:busy", this.busyStateChanged, this);
				this.sessions.on("all", this.render, this);

				// setup settings
				this.settings = new Settings();
				this.settingsview = new SettingsView({ model: this.settings });

				// setup map
				this.mapview = new MapView({
					collection: this.sessions,
					settings: this.settings
				});

				this.legendview = new LegendView({ colors: this.mapview.colors() });
				this.sessioninfoview = new InfoView({ model: this.model });

				this.mapview.on("session:selected", this.sessionSelected, this);
				this.mapview.on("result:selected", this.resultSelected, this);

				this.sessioninfoview.on("session:focussed", this.sessionFocussed, this);
				this.sessioninfoview.on("session:unfocussed", this.sessionUnfocussed, this);
				this.sessioninfoview.on("result:nav-first", this.resultsNavigateToFirst, this);
				this.sessioninfoview.on("result:nav-prev", this.resultsNavigateToPrevious, this);
				this.sessioninfoview.on("result:nav-next", this.resultsNavigateToNext, this);
				this.sessioninfoview.on("result:nav-last", this.resultsNavigateToLast, this);
			},

			render: function() {

				if (this.sessions.length)
					this.legendview.$el.show();
				else
					this.legendview.$el.hide();
			},

			clearData: function() {
				this.sessions.reset();
				// revert all attributes to defaults
				this.model.set(this.model.defaults);
			},

			// Check for the various File API support.
			checkFileAPIs: function() {

				if (window.File && window.FileReader && window.FileList && window.Blob) {
					// Great success! All the File APIs are supported.
					return true;
				} else {
					alert('The File APIs are not fully supported in this browser. Consider using Mozilla Firefox (>8) or Google Chrome (>7)!');
					return false;
				}
			},

			// Handler for the "change" event of the file input. Kick of load process.
			loadFiles: function(evt) {

				this.clearData();

				var files = evt.target.files;
				if (!files.length) {
					return;
				}

				this.numFilesQueued = files.length;
				this.model.set("busy", true);
				FileLoader.loadFiles(files, this.sessions, this.fileLoaded.bind(this));
			},

			// Called when all files have been loaded. Triggers marker rendering.
			loadComplete: function() {
				this.model.set("busy", false);
				this.mapview.drawMarkers();
			},

			// Callback for FileLoader
			fileLoaded: function(resultCode, filestats) {

				if (!this.model.has("statistics"))
					this.model.set("statistics", new Statistics());

				var stats = this.model.get("statistics");
				stats.addFileStats(filestats);
				stats.set("numSessions", this.sessions.length);
				this.model.trigger("change:statistics");

				this.numFilesQueued--;
				if (this.numFilesQueued === 0)
					this.loadComplete();
			},

			// Handler for "change" event from the session search field.
			searchSessionInputChanged: function(evt) {

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
				this.resultSelected(null);
			},

			// Handler for "session:selected" event. Update the info display.
			sessionSelected: function(session) {

				this.model.set("selectedSession", session);
			},

			// Handler for "result:selected" event. Update the info display.
			resultSelected: function(result) {

				this.model.set("selectedResult", result);
				var view = this.mapview;
				setTimeout(function(){
					view.highlightResult(result);
				}, 200);
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

		return AppView;
	}
);
