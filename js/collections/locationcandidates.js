define(
	["underscore", "backbone",
	"models/LocationCandidate"],

	function(_, Backbone, LocationCandidate) {

		var LocationCandidateList = Backbone.Collection.extend({
			model: LocationCandidate,

			constructor: function LocationCandidateList() {
				Backbone.Collection.prototype.constructor.apply(this, arguments);
			},
		});

		return LocationCandidateList;
	}
);
