define(
	["underscore", "backbone",
	"models/Session"],

	function(_, Backbone, Session) {

		var SessionList = Backbone.Collection.extend({
			model: Session,
		});

		return SessionList;
	}
);
