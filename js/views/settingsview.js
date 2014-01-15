define(
	["jquery", "underscore", "backbone",
	 "hbs!../../templates/selectoptions"],

	function($, _, Backbone, optionsTemplate) {

		var SettingsView = Backbone.View.extend({
			el: $("#settings"),

			/** @type {Settings} the settings model */
			model: null,

			/** @type {AppState} the shared app state */
			appstate: null,

			$checkConnectMarkers: null,
			$checkConnectSessions: null,
			$checkDynamicMarkerColors: null,
			$checkShowScaleControl: null,
			$checkDrawNetworkOnTop: null,
			$selectMarkerColorsAttribute: null,

			events: {
				"click #checkConnectMarkers": "toggleReferenceLines",
				"click #checkConnectSessions": "toggleSessionLines",
				"click #checkDynamicMarkerColors": "toggleDynamicMarkerColors",
				"change #selectMarkerColorsAttribute": "attributeSelectionChanged",
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
				this.$selectMarkerColorsAttribute = this.$("#selectMarkerColorsAttribute");

				//TODO: (20140115) investigate if this is still needed, it destroys our <select> HTML!
				// this.model.on("change", this.render, this);

				// listen to some state changes
				if (this.appstate) {
					this.appstate.on("change:resultsAvailable", this.enableControls, this);
					this.appstate.on("change:resultsFilterActive", this.enableControls, this);
					this.appstate.on("change:referenceLocationsAvailable", this.enableControls, this);
				}

				this.render();
			},

			enableControls: function() {

				var bFiltered = this.appstate.get('resultsFilterActive'),
					bResultsAvailable = this.appstate.get('resultsAvailable'),
					bReferenceData = this.appstate.get('referenceLocationsAvailable'),
					bUseDynamicColors = this.model.get("useDynamicMarkerColors");
				this.$checkConnectMarkers.prop("disabled", bReferenceData === false || bFiltered);
				this.$checkConnectSessions.prop("disabled", bFiltered);

				// dynamic marker colors not for .distance files...
				var bDynamicColorsDisabled = bResultsAvailable === false || bReferenceData;
				this.$checkDynamicMarkerColors.prop("disabled", bDynamicColorsDisabled);
				this.$selectMarkerColorsAttribute.prop("disabled", bDynamicColorsDisabled || !bUseDynamicColors);
			},

			render: function() {

				this.renderMarkerAttributeOptions();
				this.enableControls();

				this.$checkConnectMarkers.prop("checked", this.model.get("drawReferenceLines"));
				this.$checkConnectSessions.prop("checked", this.model.get("drawSessionLines"));
				this.$checkDynamicMarkerColors.prop("checked", this.model.get("useDynamicMarkerColors"));
				this.$checkShowScaleControl.prop("checked", this.model.get("showScaleControl"));
				this.$checkDrawNetworkOnTop.prop("checked", this.model.get("drawNetworkOnTop"));

				return this;
			},

			renderMarkerAttributeOptions: function() {

				// TODO: (20140115) make this dynamic?
				var context = {
					options: [
						// { title: "Select...", value: "" },
						{ title: "Confidence", value: "confidence" },
						{ title: "Mobility Probability", value: "probMobility" },
						{ title: "Indoor Probability", value: "probIndoor" },
					]
				};

				this.$selectMarkerColorsAttribute.html(optionsTemplate(context));
				return this;
			},

			toggleReferenceLines: function() {
				this.model.set("drawReferenceLines", this.$checkConnectMarkers.prop("checked"));
			},

			toggleSessionLines: function() {
				this.model.set("drawSessionLines", this.$checkConnectSessions.prop("checked"));
			},

			toggleDynamicMarkerColors: function() {
				var bUseDynamicColors = this.$checkDynamicMarkerColors.prop("checked");
				this.$selectMarkerColorsAttribute.prop("disabled", !bUseDynamicColors);

				this.model.set("useDynamicMarkerColors", bUseDynamicColors);
			},

			toggleScaleControl: function() {
				this.model.set("showScaleControl", this.$checkShowScaleControl.prop("checked"));
			},

			toggleNetworkOnTop: function() {
				this.model.set("drawNetworkOnTop", this.$checkDrawNetworkOnTop.prop("checked"));
			},

			attributeSelectionChanged: function() {
				this.model.set("markerColorAttribute", this.$selectMarkerColorsAttribute.val());
			}
		});

		return SettingsView;
	}
);
