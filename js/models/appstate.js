define(
	["backbone"],

	function(Backbone) {

		var AppState = Backbone.Model.extend({

			defaults: {
				// the model of the selected/active session
				selectedSession: null,

				// the model of the selected result/sample
				selectedResult: null,

				// id of the last focussed session
				focussedSessionId: -1,

				files: []
			},
		});

		return AppState;
	}
);
