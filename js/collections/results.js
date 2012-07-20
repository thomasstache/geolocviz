define(
	["underscore", "backbone",
	"models/AccuracyResult"],

	function(_, Backbone, AccuracyResult) {

		var ResultList = Backbone.Collection.extend({
			model: AccuracyResult,
		});

		return ResultList;
	}
);
