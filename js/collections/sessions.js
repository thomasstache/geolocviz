define(
	["underscore", "backbone",
	"models/session", "types/searchresult"],

	function(_, Backbone, Session, SearchResult) {

		var SessionList = Backbone.Collection.extend({
			model: Session,

			/**
			 * Returns the session with the given ID.
			 * @param  {Number} sessionId
			 * @return {Session}
			 */
			findSession: function(sessionId) {

				// try to find by "id" (for AXF sessions)
				var session = this.get(sessionId);
				if (!session) {
					// look in the model attributes (for accuracy sessions, where "id" is mangled with fileId)
					var properties = { sessionId: sessionId };
					session = this.findWhere(properties);
				}
				return session;
			},

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
			 * @param  {Number} messageId
			 * @return {SearchResult}
			 */
			findResult: function(messageId) {

				var resultProps = { msgId: messageId };
				// lookup session including the result
				var session = this.findSessionWithResult(resultProps);

				var result = null;
				if (session !== undefined)
					result = session.results.findWhere(resultProps);

				return new SearchResult(session || null, result);
			}
		});

		return SessionList;
	}
);
