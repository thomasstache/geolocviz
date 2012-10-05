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
			},

			/**
			 * Returns the index of the result in its collection.
			 * Returns -1 if there is no collection.
			 */
			getIndex: function() {
				return this.collection ? this.collection.indexOf(this) : -1;
			},

			/**
			 * Returns whether there is a successor item in the collection.
			 */
			hasNext: function() {
				return this.collection && this.getIndex() < this.collection.length - 1;
			},

			/**
			 * Returns whether there is a predecessor item in the collection.
			 */
			hasPrevious: function() {
				return this.collection && this.getIndex() > 0;
			}
		});

		return BaseResult;
	}
);
