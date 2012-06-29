$(function(){

	var DataPoint = Backbone.Model.extend({

		defaults: function() {
			return {
				id: 1,
				sessionId: 0,
				order: DataPoints.nextOrder(),
				lon: 0.0,
				lat: 0.0,
				dist: 10.0,
				confidence: 0.0
			};
		},

		initialize: function() {
		},

		clear: function() {
			this.destroy();
		}
	});

	var DataList = Backbone.Collection.extend({
		model: DataPoint,

		// Save all of the items under this namespace.
		localStorage: new Store("geoloc-backbone"),

		nextOrder: function() {
	    	if (!this.length) return 1;
	    	return this.last().get('order') + 1;
	    },

	    // Todos are sorted by their original insertion order.
	    comparator: function(todo) {
	    	return todo.get('order');
	    },

	});

	var DataPoints = new DataList;

	var RecordView = Backbone.View.extend({
		tagName: "tr",

		// Cache the template function for a single item.
		template: _.template($('#record-template').html()),

		events: {
			// nothing
		},

		initialize: function() {
			this.model.bind("change", this.render, this);
			this.model.bind('destroy', this.remove, this);
		},

		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			return this;
		}
	});

	var AppView = Backbone.View.extend({
		el: $("#playground-app"),

		events: {
			"change #file-input": "loadFile"
		},

		initialize: function() {
			DataPoints.bind('add', this.addNewItem, this);
			DataPoints.bind('reset', this.addAllItems, this);
			DataPoints.bind('all', this.render, this);

			this.main = this.$('#main');
			this.fileInput = this.$('#file-input')[0];
		},

		/** ***************************************************************
		 * File parsing + handling
		 */

		loadAccuracyFile: function(file) {

			var start = 0;
			var stop = file.size - 1;
			var blob;

			var reader = new FileReader();
			// If we use onloadend, we need to check the readyState.
			reader.onloadend = this.onAccuracyFileLoaded.bind(this);

			if (file.webkitSlice) {
				blob = file.webkitSlice(start, stop + 1);
			} else if (file.mozSlice) {
				blob = file.mozSlice(start, stop + 1);
			}

			reader.readAsBinaryString(blob);
		},

		loadFile: function(evt) {

			var files = this.fileInput.files;
			if (!files.length) {
				return;
			}
			this.loadAccuracyFile(files[0]);
		},

		onAccuracyFileLoaded: function(evt) {
			// evt: ProgressEvent, target is the FileReader
			var rdr = evt.target;
			if (rdr.readyState == FileReader.DONE) {
				//console.log(evt.target.result);
				var csvArray = [];
				csvArray = jQuery.csv("\t")(rdr.result);

				for (var ct = 1; ct < csvArray.length; ct++) {
					this.parseV3Record(csvArray[ct]);
				}
			}
		},

		/* Parses a line from the new (v6.1) file format:
		 * Headers:
		 * FileId | MessNum | DTLatitude | DTLongitude | CTLatitude | CTLongitude | Distance | PositionConfidence | MobilityProb | IndoorProb | SessionId
		 */
		parseV3Record: function(record) {
			//to do: Replace column numbers by link related to col headings
			var IDX = Object.freeze({
				FILEID: 0,
				MSGID: 1,
				REF_LAT: 2,
				REF_LON: 3,
				GEO_LAT: 4,
				GEO_LON: 5,
				DIST: 6,
				CONF: 7,
				PROB_MOB: 8,
				PROB_INDOOR: 9,
				SESSIONID: 10
			});

			var msgId = record[IDX.MSGID];
			var sessId = record[IDX.SESSIONID];
			var confidence = record[IDX.CONF];
			var probMobile = record[IDX.PROB_MOB];
			var probIndoor = record[IDX.PROB_INDOOR];

			// reference markers
			var refLat = parseFloat(record[IDX.REF_LAT]);
			var refLng = parseFloat(record[IDX.REF_LON]);

			// geolocation markers
			var glLat = parseFloat(record[IDX.GEO_LAT]);
			var glLng = parseFloat(record[IDX.GEO_LON]);

			var distReported = record[IDX.DIST];

			var letter = "M";
			if (probMobile < .5)
			{
				letter = "S";
			}
			if (probIndoor > .5)
			{
				letter = "I";
			}

			DataPoints.create({
				id: msgId,
				sessionId: sessId,
				lon: glLng,
				lat: glLat,
				dist: distReported,
				confidence: confidence
			});
		},

		// a percentage formatter assuming values [0,1], omitting unit for NaNs
		asPercent: function(val) {
			return isNaN(val) ? val
							  : Math.round(val * 100) + "%";
		},


		/** ***************************************************************
		 * View creation
		 */
		addNewItem: function(datum) {
			var v = new RecordView({model: datum});
			this.$("#data-view-body").append(v.render().el);
		},

		addAllItems: function() {
			DataPoints.each(addNewItem);
		},

		render: function() {
			// all app view updates we might need...
			if (DataPoints.length) {
				this.main.show();
			}
			else {
				this.main.hide();
			}
		}
	});

	var myApp = new AppView();
})
