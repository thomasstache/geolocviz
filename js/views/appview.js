define(

	["jquery", "underscore", "backbone",
	 "views/mapview", "views/settingsview", "views/legendview", "views/sessioninfoview",
	 "collections/sessions", "models/settings", "FileLoader"],

	function($, _, Backbone,
			 MapView, SettingsView, LegendView, SessionInfoView,
			 SessionList, Settings, FileLoader) {

		var AppView = Backbone.View.extend({
			el: $("#playground-app"),

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
				this.sessioninfoview = new SessionInfoView();

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
				this.sessioninfoview.update();
			},

			loadFile: function(evt) {

				this.clearData();

				var files = evt.target.files;
				if (!files.length) {
					return;
				}

				FileLoader.loadFiles(files, this.sessions);
			},

			// Handler for "session:selected" event. Update the info display.
			sessionSelected: function(session) {

				this.sessioninfoview.update(session);
			},

			// Handler for "session:focussed" event. Zoom the map view.
			sessionFocussed: function(session) {

				this.mapview.focusSession(session);
			},

			// Handler for "session:unfocussed" event. Zoom the map view.
			sessionUnfocussed: function() {

				this.mapview.zoomToBounds();
			}
		});

		return AppView;
	}
);
