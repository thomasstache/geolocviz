define(
	["collections/sessions", "models/session", "models/axfresult"],

	function(SessionList, Session, AxfResult) {

		var FileWriter = (function() {

			var textFile = null;

			makeTextFile = function (text) {
				var data = new Blob([text], {type: 'text/plain'});

				// If we are replacing a previously generated file we need to
				// manually revoke the object URL to avoid memory leaks.
				if (textFile !== null) {
				  window.URL.revokeObjectURL(textFile);
				}

				textFile = window.URL.createObjectURL(data);

				// returns a URL you can use as a href
				return textFile;
			};


			// return public API
			return {

				/**
				 * Creates the content of an AXF file
				 * @param  {SessionList} sessions the list of Session models
				 * @return {ObjectURL}            the file as object URL
				 */
				createAxfFileAsURL: function(sessions) {

				}
			};
		})();

		return FileWriter;
	}
);