define(
	["jquery", "backbone"],

	function($, Backbone) {

		var LabelView = Backbone.View.extend({

			el: $("#labelView"),

			$labelInput: null,

			label: "",

			events: {
				"click #editLabelLink": "startEditing",
				"change #labelInput" : "labelChanged",
				"blur #labelInput"   : "stopEditing",
			},

			initialize: function() {

				this.$labelInput = $("#labelInput");

				this.$labelInput.val(this.label);
				if (this.label.length > 0)
					this.$labelInput.show();
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
			},
		});

		return LabelView;
	}
);
