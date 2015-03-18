define(
	["underscore", "backbone",
	 "models/baseresult"],

	function(_, Backbone, BaseResult) {

		var ResultList = Backbone.Collection.extend({
			model: BaseResult,

			constructor: function ResultList() {
				Backbone.Collection.prototype.constructor.apply(this, arguments);
			},
		});

		return ResultList;
	}
);
