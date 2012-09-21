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

				this.mapview.on("session:selected", this.sessionSelected, this);

				this.legendview = new LegendView({ colors: this.mapview.colors() });
				this.sessioninfoview = new SessionInfoView();
			},

			render: function() {

				if (this.sessions.length)
					this.legendview.$el.show();
				else
					this.legendview.$el.hide();
			},

			clearData: function() {
				this.sessions.reset();
			},

			loadFile: function(evt) {

				this.clearData();

				var files = evt.target.files;
				if (!files.length) {
					return;
				}

				FileLoader.loadFiles(files, this.sessions);
			},

			sessionSelected: function(session) {

				this.sessioninfoview.update(session);
			}
		});

		return AppView;
	}
);
