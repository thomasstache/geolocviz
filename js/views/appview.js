define(

	["jquery", "underscore", "backbone",
	"views/mapview", "collections/sessions", "FileLoader"],

	function($, _, Backbone, MapView, SessionList, FileLoader) {

		var AppView = Backbone.View.extend({
			el: $("#playground-app"),

			events: {
				"change #file-input": "loadFile"
			},

			sessions: null,

			initialize: function() {
				this.sessions = new SessionList();

				this.mapview = new MapView({
					collection: this.sessions
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
