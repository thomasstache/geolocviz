define(

	["jquery", "underscore", "backbone",
	 "views/mapview", "views/settingsview", "views/legendview", "views/sessioninfoview",
	 "collections/sessions", "models/settings", "models/appstate", "FileLoader"],

	function($, _, Backbone,
			 MapView, SettingsView, LegendView, SessionInfoView,
			 SessionList, Settings, AppState, FileLoader) {

		var AppView = Backbone.View.extend({
			el: $("#playground-app"),

			model: new AppState(),

			events: {
				"change #fileInput": "loadFile"
			},

			sessions: null,

			settings: null,

			initialize: function() {

				// init model
				this.sessions = new SessionList();
				// listen to changes
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
				this.sessioninfoview = new SessionInfoView({ model: this.model });

				this.mapview.on("session:selected", this.sessionSelected, this);
				this.sessioninfoview.on("session:focussed", this.sessionFocussed, this);
				this.sessioninfoview.on("session:unfocussed", this.sessionUnfocussed, this);
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

			loadFile: function(evt) {

				this.clearData();

				var files = evt.target.files;
				if (!files.length) {
					return;
				}

				this.model.set("files", _.map(files, function(f) { return f.name; }));
				FileLoader.loadFiles(files, this.sessions);
			},

			// Handler for "session:selected" event. Update the info display.
			sessionSelected: function(session) {

				this.model.set("selectedSession", session);
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
			}
		});

		return AppView;
	}
);
