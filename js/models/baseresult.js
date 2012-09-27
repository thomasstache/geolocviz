define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var BaseResult = Backbone.Model.extend({

			defaults: {
				// id of the original CT message
				msgId: -1,
				// id of the "call" session
				sessionId: -1,
				// geolocated position
				latLng: null,
			},

			category: function() {
				var cat = "M";
				if (this.get('probMobility') <= 0.5) // stationary
					cat = "S";
				if (this.get('probIndoor') > 0.5) // indoor
					cat = "I";
				return cat;
			},

			getInfo: function() {
				return this.toJSON();
			}
		});

		return BaseResult;
	}
);
