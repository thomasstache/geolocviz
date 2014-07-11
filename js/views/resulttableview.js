define(

	["jquery", "underscore", "backbone",
	 "views/tabledialogview",
	 "collections/sortablecollection", "models/session",
	 "types/searchquery",
	 "hbs!templates/resulttablerows"],

	function($, _, Backbone,
			 TableDialogView,
			 SortableCollection, Session, SearchQuery,
			 bodyTemplate) {

		var ResultTableView = TableDialogView.extend({

			id: "recordTableDialog",

			caption: "",

			columns: [
				{ attribute: "num",          caption: "#" },
				{ attribute: "msgId",        caption: "ID", isSorted: true, dirDesc: false },
				{ attribute: "timestamp",    caption: "Time", unit: "s" },
				{ attribute: "confidence",   caption: "Confidence" },
				{ attribute: "probMobility", caption: "Mobility Prob." },
				{ attribute: "probIndoor",   caption: "Indoor Prob." },
				// { attribute: "meanSpeed",    caption: "Speed",    unit: "km/h" },
			],

			sortAttribute: "msgId",
			sortDirection: SortableCollection.SORT_ASCENDING,

			bodyTemplate: bodyTemplate,

			/** @type {Session} */
			session: null,

			events: {
				"click .selectItem": "selectResultClick",
			},

			initialize: function(options) {

				_.extend(this.events, TableDialogView.prototype.events);

				var session = options.session || null;

				if (session) {

					this.caption = "Records in Session " + session.get("sessionId");
					this.session = session;
				}

				TableDialogView.prototype.initialize.apply(this);
			},

			/**
			 * Create a sortable collection with the extracted result "info"
			 */
			fillCollection: function() {

				var infos = this.session.results.map(function(result) {
					return result.getInfo();
				});

				this.collection.reset(infos);
			},

			/**
			 * Handler for clicks on linkified result Ids.
			 * @param  {Event} evt The jQuery click event
			 */
			selectResultClick: function(evt) {
				evt.preventDefault();

				var strResultId = evt.currentTarget.textContent;
				this.trigger("search", new SearchQuery(SearchQuery.TOPIC_RESULT, strResultId));
			},
		});

		return ResultTableView;
	}
);