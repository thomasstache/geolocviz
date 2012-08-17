define(

	["jquery", "underscore", "backbone",
	"views/mapview", "views/settingsview", "collections/sessions", "models/settings", "FileLoader"],

	function($, _, Backbone, MapView, SettingsView, SessionList, Settings, FileLoader) {

		var AppView = Backbone.View.extend({
			el: $("#playground-app"),

			events: {
				"change #fileInput": "loadFile"
			},

			sessions: null,

			settings: null,

			initialize: function() {
				this.sessions = new SessionList();

				// setup settings
				this.settings = new Settings();
				this.settingsview = new SettingsView({ model: this.settings });

				// setup map
				this.mapview = new MapView({
					collection: this.sessions,
					settings: this.settings
				});

				this.mapview.render();
			},

			render: function() {
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

		});

		return AppView;
	}
);
