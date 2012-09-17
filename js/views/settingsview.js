define(
	["jquery", "underscore", "backbone"],

	function($, _, Backbone) {

		var SettingsView = Backbone.View.extend({
			el: $("#settings"),

			events: {
				"click #checkConnectMarkers": "toggleReferenceLines",
				"click #checkConnectSessions": "toggleSessionLines"
			},

			initialize: function() {
				this.$checkConnectMarkers = $("#checkConnectMarkers");
				this.$checkConnectSessions = $("#checkConnectSessions");

				this.$checkConnectMarkers.prop("checked", this.model.get("drawReferenceLines"));
				this.$checkConnectSessions.prop("checked", this.model.get("drawSessionLines"));
			},

			toggleReferenceLines: function() {
				this.model.set("drawReferenceLines", this.$checkConnectMarkers.prop("checked"));
			},

			toggleSessionLines: function() {
				this.model.set("drawSessionLines", this.$checkConnectSessions.prop("checked"));
			},

		});

		return SettingsView;
	}
);
