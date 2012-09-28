define(
	["underscore", "backbone",
	"models/session"],

	function(_, Backbone, Session) {

		var SessionList = Backbone.Collection.extend({
			model: Session,
		});

		return SessionList;
	}
);
