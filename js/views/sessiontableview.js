define(

	["jquery", "underscore", "backbone",
	 "collections/sortablecollection",
	 "models/session",
	 "hbs!templates/sessiontable", "hbs!templates/sessiontablerows"],

	function($, _, Backbone,
			 SortableCollection, Session,
			 tableDialogTemplate, bodyTemplate) {

		var SessionTableView = Backbone.View.extend({

			// tag,ID for the autogenerated node the view will be enclosed in
			tagName: "div",
			id: "sessionTableDialog",

			$tableBody: null,

			/** @type {SortableCollection} */
			collection: null,

			events: {
				"click #btnClose": "close",
				"click th": "headerClick",
			},

			initialize: function(options) {

				var sessions = options.sessions || null;

				if (sessions) {

					// create a sortable collection with the session "info"
					var sessionInfo = sessions.map(function(session) {
						return session.getInfo();
					});

					this.collection = new SortableCollection(sessionInfo);
					// sort for testing fun
					this.collection.setSortAttribute("sessionId")
								   .setSortDirection(SortableCollection.SORT_ASCENDING)
								   .sort();

					this.render();

					this.listenTo(this.collection, "sort", this.updateTable);
				}
			},

			// create the dialog and insert into page DOM
			render: function() {

				var columns = [
					{ attribute: "sessionId",    caption: "ID" },
					{ attribute: "resultCount",  caption: "Results" },
					{ attribute: "confidence",   caption: "Confidence" },
					{ attribute: "probMobility", caption: "Mobility Prob." },
					{ attribute: "probIndoor",   caption: "Indoor Prob." },
					{ attribute: "distance",     caption: "Distance", unit: "m" },
					{ attribute: "duration",     caption: "Duration", unit: "s" },
					{ attribute: "meanSpeed",    caption: "Speed",    unit: "km/h" },
				];
				var context = {
					title: "Sessions",
					columns: columns
				};

				this.$el.html(tableDialogTemplate(context));
				$(document.body).append(this.$el);

				this.$tableBody = this.$("#sessionTableBody");

				this.updateTable();

				return this;
			},

			// Render the table body with the current sort configuration.
			updateTable: function() {

				if (this.$tableBody !== null) {

					// convert Models to JS objects
					var data = this.collection.map(function(info) {
						return info.toJSON();
					});

					var context = {
						sessions: data,
					};

					this.$tableBody.html(bodyTemplate(context));
				}

				return this;
			},

			/**
			 * Handler for clicks on the table column headers. Sort data accordingly.
			 * @param  {Event} evt jQuery click event
			 */
			headerClick: function(evt) {

				if (!evt.currentTarget)
					return;

				var el = evt.currentTarget;
				if (el.dataset &&
					el.dataset.modelattr !== undefined) {

					var sortAttr = el.dataset.modelattr;

					// flip sort direction, if same column
					if (this.collection.sortAttribute === sortAttr) {
						this.collection.invertDirection().sort();
					}
					else {
						this.collection.setSortAttribute(sortAttr)
									   .setSortDirection(SortableCollection.SORT_ASCENDING)
									   .sort();
					}
				}
			},

			close: function() {

				this.trigger("dialog:cancel");
				this.remove();
			},
		});

		return SessionTableView;
	}
);