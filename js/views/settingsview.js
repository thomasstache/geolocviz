define(
	["jquery", "underscore", "backbone"],

	function($, _, Backbone) {

		var SettingsView = Backbone.View.extend({
			el: $("#settings"),

			events: {
				"click #checkConnectMarkers": "toggleReferenceLines",
				"click #checkConnectSessions": "toggleSessionLines",
				"click #checkShowScaleControl": "toggleScaleControl"
			},

			initialize: function() {
				this.$checkConnectMarkers = $("#checkConnectMarkers");
				this.$checkConnectSessions = $("#checkConnectSessions");
				this.$checkShowScaleControl = this.$("#checkShowScaleControl");

				this.model.on("change", this.render, this);
				this.render();
			},

			render: function() {

				this.$checkConnectMarkers.prop("checked", this.model.get("drawReferenceLines"));
				this.$checkConnectSessions.prop("checked", this.model.get("drawSessionLines"));
				this.$checkShowScaleControl.prop("checked", this.model.get("showScaleControl"));
			},

			toggleReferenceLines: function() {
				this.model.set("drawReferenceLines", this.$checkConnectMarkers.prop("checked"));
			},

			toggleSessionLines: function() {
				this.model.set("drawSessionLines", this.$checkConnectSessions.prop("checked"));
			},

			toggleScaleControl: function() {
				this.model.set("showScaleControl", this.$("#checkShowScaleControl").prop("checked"));
			}
		});

		return SettingsView;
	}
);
