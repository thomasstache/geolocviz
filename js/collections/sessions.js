define(
	["underscore", "backbone",
	"models/session"],

	function(_, Backbone, Session) {

		var SessionList = Backbone.Collection.extend({
			model: Session,

			/**
			 * Returns the first session whose result list has a match for all the properties.
			 * @param  {Object} resultProps List of key-value pairs that should match
			 * @return {Session}
			 */
			findSessionWithResult: function(resultProps) {

				var rv = this.find(function(session) {

					var matchingSectors = session.results.where(resultProps);
					return matchingSectors &&
						   matchingSectors.length > 0;
				});
				return rv;
			},

			/**
			 * Returns the result with the given ID.
			 * @param  {Number} id
			 * @return {BaseResult}
			 */
			findResult: function(id) {

				var resultProps = { msgId: id };
				// lookup session including the result
				var session = this.findSessionWithResult(resultProps);

				var result = null;
				if (session !== undefined)
					result = session.results.findWhere(resultProps);

				return result;
			}
		});

		return SessionList;
	}
);
