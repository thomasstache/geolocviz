define(
	["underscore", "backbone"],

	function(_, Backbone) {

		var BaseResult = Backbone.Model.extend({

			defaults: {
				// id of the original CT message
				msgId: -1,
				// id of the "call" session
				sessionId: -1,
				// @type {Position} geolocated position
				position: null,

				// time offset
				timestamp: 0,
			},

			constructor: function BaseResult() {
				Backbone.Model.prototype.constructor.apply(this, arguments);
			},

			category: function(thresholds) {

				var cat, probMobility = this.get('probMobility');

				if (this.get('probIndoor') > thresholds.indoor) {
					// indoor
					if (probMobility < thresholds.mobility) // stationary
						cat = "I";
					else
						cat = "IM";
				}
				else {
					// outdoor
					if (probMobility < thresholds.mobility) // stationary
						cat = "S";
					else
						cat = "M";
				}
				return cat;
			},

			getInfo: function() {
				return this.toJSON();
			},

			/**
			 * Returns the attributes identifying the serving sector.
			 * @return {Object} a property hash
			 */
			getSectorProperties: function() {
				return {};
			},

			/**
			 * Returns the geolocated position.
			 * @return {Position}
			 */
			getGeoPosition: function() {
				return this.get('position');
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
