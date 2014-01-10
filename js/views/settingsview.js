define(
	["jquery", "underscore", "backbone"],

	function($, _, Backbone) {

		var SettingsView = Backbone.View.extend({
			el: $("#settings"),

			/** @type {Settings} the settings model */
			model: null,

			/** @type {AppState} the shared app state */
			appstate: null,

			events: {
				"click #checkConnectMarkers": "toggleReferenceLines",
				"click #checkConnectSessions": "toggleSessionLines",
				"click #checkDynamicMarkerColors": "toggleDynamicMarkerColors",
				"click #checkShowScaleControl": "toggleScaleControl",
				"click #checkDrawNetworkOnTop": "toggleNetworkOnTop"
			},

			initialize: function() {

				this.appstate = this.options.appstate;

				this.$checkConnectMarkers = $("#checkConnectMarkers");
				this.$checkConnectSessions = $("#checkConnectSessions");
				this.$checkDynamicMarkerColors = this.$("#checkDynamicMarkerColors");
				this.$checkShowScaleControl = this.$("#checkShowScaleControl");
				this.$checkDrawNetworkOnTop = this.$("#checkDrawNetworkOnTop");

				this.model.on("change", this.render, this);

				// listen to some state changes
				if (this.appstate) {
					this.appstate.on("change:resultsAvailable", this.enableControls, this);
					this.appstate.on("change:resultsFilterActive", this.enableControls, this);
					this.appstate.on("change:referenceLocationsAvailable", this.enableControls, this);
				}

				this.render();
			},

			enableControls: function() {

				var bFiltered = this.appstate.get('resultsFilterActive');
				var bResultsAvailable = this.appstate.get('resultsAvailable');
				var bReferenceData = this.appstate.get('referenceLocationsAvailable');
				this.$checkConnectMarkers.prop("disabled", bReferenceData === false || bFiltered);
				this.$checkConnectSessions.prop("disabled", bFiltered);

				// dynamic marker colors not for .distance files...
				this.$checkDynamicMarkerColors.prop("disabled", bResultsAvailable === false || bReferenceData);
			},

			render: function() {

				this.enableControls();

				this.$checkConnectMarkers.prop("checked", this.model.get("drawReferenceLines"));
				this.$checkConnectSessions.prop("checked", this.model.get("drawSessionLines"));
				this.$checkDynamicMarkerColors.prop("checked", this.model.get("useDynamicMarkerColors"));
				this.$checkShowScaleControl.prop("checked", this.model.get("showScaleControl"));
				this.$checkDrawNetworkOnTop.prop("checked", this.model.get("drawNetworkOnTop"));
			},

			toggleReferenceLines: function() {
				this.model.set("drawReferenceLines", this.$checkConnectMarkers.prop("checked"));
			},

			toggleSessionLines: function() {
				this.model.set("drawSessionLines", this.$checkConnectSessions.prop("checked"));
			},

			toggleDynamicMarkerColors: function() {
				this.model.set("useDynamicMarkerColors", this.$checkDynamicMarkerColors.prop("checked"));
			},

			toggleScaleControl: function() {
				this.model.set("showScaleControl", this.$checkShowScaleControl.prop("checked"));
			},

			toggleNetworkOnTop: function() {
				this.model.set("drawNetworkOnTop", this.$checkDrawNetworkOnTop.prop("checked"));
			}
		});

		return SettingsView;
	}
);
