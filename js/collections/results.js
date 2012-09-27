define(
	["underscore", "backbone",
	 "models/baseresult"],

	function(_, Backbone, BaseResult) {

		var ResultList = Backbone.Collection.extend({
			model: BaseResult,
		});

		return ResultList;
	}
);
