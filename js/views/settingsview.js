define(
	["jquery", "underscore", "backbone",
	 "views/settingsdialog",
	 "models/settings",
	 "hbs!templates/selectoptions"],

	function($, _, Backbone, SettingsDialog, Settings, optionsTemplate) {

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
			$moreSettingsButton: null,

			/** @type {SettingsDialog} reference to the dialog node, while open */
			settingsDialog: null,

			events: {
				"click #checkConnectMarkers": "toggleReferenceLines",
				"click #checkConnectSessions": "toggleSessionLines",
				"click #checkDynamicMarkerColors": "toggleDynamicMarkerColors",
				"change #selectMarkerColorsAttribute": "attributeSelectionChanged",
				"click #checkShowScaleControl": "toggleScaleControl",
				"click #checkDrawNetworkOnTop": "toggleNetworkOnTop",
				"click #btnMore": "moreSettingsButtonClicked",
			},

			initialize: function(options) {

				this.appstate = options.appstate;

				this.$checkConnectMarkers = this.$("#checkConnectMarkers");
				this.$checkConnectSessions = this.$("#checkConnectSessions");
				this.$checkDynamicMarkerColors = this.$("#checkDynamicMarkerColors");
				this.$checkShowScaleControl = this.$("#checkShowScaleControl");
				this.$checkDrawNetworkOnTop = this.$("#checkDrawNetworkOnTop");
				this.$selectMarkerColorsAttribute = this.$("#selectMarkerColorsAttribute");
				this.$moreSettingsButton = this.$("#btnMore");

				this.model.on("reset", this.render, this);

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
				this.$selectMarkerColorsAttribute.prop("disabled", bDynamicColorsDisabled);
			},

			render: function() {

				this.renderMarkerAttributeOptions();
				this.enableControls();

				this.$checkConnectMarkers.prop("checked", this.model.get("drawReferenceLines"));
				this.$checkConnectSessions.prop("checked", this.model.get("drawSessionLines"));
				this.$checkDynamicMarkerColors.prop("checked", this.model.get("useDynamicMarkerColors"));
				this.$checkShowScaleControl.prop("checked", this.model.get("showScaleControl"));
				this.$checkDrawNetworkOnTop.prop("checked", this.model.get("drawNetworkOnTop"));

				this.renderSettingsButton();

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
				this.$selectMarkerColorsAttribute.val(this.model.get("markerColorAttribute"));

				return this;
			},

			renderSettingsButton: function() {
				this.$moreSettingsButton.toggleClass("customized", this.model.hasCustomSettings());
			},

			/*********************** Popup dialog ***********************/

			// show settings dialog
			moreSettingsButtonClicked: function() {

				var dialog = new SettingsDialog({ model: this.model });
				this.listenToOnce(dialog, "dialog:apply", this.onSettingsApplied);
				this.listenToOnce(dialog, "dialog:cancel", this.onSettingsDialogClosed);
				this.settingsDialog = dialog;
			},

			/**
			 * Handler for the "Ok" button in the dialog.
			 */
			onSettingsApplied: function() {

				this.renderSettingsButton();
				this.onSettingsDialogClosed();
			},

			/**
			 * Handler for the "Cancel" button in the dialog.
			 */
			onSettingsDialogClosed: function() {

				this.stopListening(this.settingsDialog);
				this.settingsDialog = null;
			},

			/*********************** Inline settings ***********************/

			toggleReferenceLines: function() {
				this.model.set("drawReferenceLines", this.$checkConnectMarkers.prop("checked"));
			},

			toggleSessionLines: function() {
				this.model.set("drawSessionLines", this.$checkConnectSessions.prop("checked"));
			},

			toggleDynamicMarkerColors: function() {
				var bUseDynamicColors = this.$checkDynamicMarkerColors.prop("checked");

				_.defer(function() {
					this.model.set("useDynamicMarkerColors", bUseDynamicColors);
				}.bind(this));
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
