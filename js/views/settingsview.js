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
				"click #checkShowScaleControl": "toggleScaleControl"
			},

			initialize: function() {

				this.appstate = this.options.appstate;

				this.$checkConnectMarkers = $("#checkConnectMarkers");
				this.$checkConnectSessions = $("#checkConnectSessions");
				this.$checkShowScaleControl = this.$("#checkShowScaleControl");

				this.model.on("change", this.render, this);

				// listen to some state changes
				if (this.appstate) {
					this.appstate.on("change:resultsFilterActive", this.render, this);
					this.appstate.on("change:referenceLocationsAvailable", this.render, this);
				}

				this.render();
			},

			render: function() {

				var bFiltered = this.appstate.get('resultsFilterActive');
				var bReferenceData = this.appstate.get('referenceLocationsAvailable');
				this.$checkConnectMarkers.prop("disabled", bReferenceData === false || bFiltered);
				this.$checkConnectSessions.prop("disabled", bFiltered);

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
				this.model.set("showScaleControl", this.$checkShowScaleControl.prop("checked"));
			}
		});

		return SettingsView;
	}
);
