define(
	["backbone"],

	function(Backbone) {

		var AppState = Backbone.Model.extend({

			defaults: {
				// if the app is busy/waiting
				busy: false,

				// the model of the selected/active session
				selectedSession: null,

				// the model of the selected result/sample
				selectedResult: null,

				// id of the last focussed session
				focussedSessionId: -1,

				// statistics about loaded files and records
				statistics: null
			},
		});

		return AppState;
	}
);
