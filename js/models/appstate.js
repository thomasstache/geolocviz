define(
	["backbone"],

	function(Backbone) {

		var AppState = Backbone.Model.extend({

			defaults: {
				// the Session model
				selectedSession: null,

				// id of the last focussed session
				focussedSessionId: -1,

				files: []
			},
		});

		return AppState;
	}
);
