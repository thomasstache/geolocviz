define(
	["jquery", "backbone"],

	function($, Backbone) {

		var LabelView = Backbone.View.extend({

			el: $("#labelView"),

			$labelInput: null,

			label: "",

			historyAPI: false,

			events: {
				"click #editLabelLink": "startEditing",
				"change #labelInput" : "labelChanged",
				"keyup #labelInput"   : "labelInputKeyUp",
				"blur #labelInput"   : "stopEditing",
			},

			initialize: function() {

				this.checkHistoryAPI();

				this.$labelInput = this.$("#labelInput");

				this.initLabelFromHistory();

				this.$labelInput.val(this.label);
				if (this.label.length > 0)
					this.$labelInput.show();
			},

			checkHistoryAPI: function() {
				this.historyAPI = history.state !== undefined &&
								  history.replaceState !== undefined;
			},

			startEditing: function() {
				this.$labelInput.prop("disabled", false)
								.toggleClass("hidden", false)
								.focus();
			},

			stopEditing: function() {
				this.$labelInput.prop("disabled", true)
								.toggleClass("hidden", this.label.length === 0);
			},

			labelChanged: function() {

				this.label = this.$labelInput.val();
				this.stopEditing();
				this.saveLabelInHistory();
			},

			labelInputKeyUp: function(evt) {
				if (evt.keyCode != 13)
					return;

				// ENTER pressed, trigger commit
				this.labelChanged();
			},

			/**
			 * Retrieves the last label from the browser history.
			 */
			initLabelFromHistory: function() {

				if (!this.historyAPI)
					return;

				if (history.state !== null) {
					this.label = history.state.label || "";
				}
				else if (window.location.hash !== "") {
					// location hash without state: clear hash
					this.clearLabelFromHistory();
				}
			},

			/**
			 * Remember the label in URL hash
			 * @param {String} label
			 */
			saveLabelInHistory: function() {

				if (!this.historyAPI)
					return;

				if (this.label.length > 0) {
					var hash = "#l=" + this.label;
					history.replaceState({label: this.label}, window.title, hash);
				}
				else {
					this.clearLabelFromHistory();
				}
			},

			/**
			 * Delete history state and URL hash
			 * @param {String} label
			 */
			clearLabelFromHistory: function() {

				if (!this.historyAPI)
					return;

				// clear hash and state
				history.replaceState(null, "", ".");
			},
		});

		return LabelView;
	}
);
