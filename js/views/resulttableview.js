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

			constructor: function ResultTableView() {
				TableDialogView.prototype.constructor.apply(this, arguments);
			},

			id: "recordTableDialog",

			caption: "",

			columns: [
				{ attribute: "msgId",        caption: "ID", isSorted: true, dirDesc: false, properties: { class: "firstCol" } },
				{ attribute: "num",          caption: "#",  properties: { width: "5%" } },
				{ attribute: "timeDelta",    caption: "ΔTime", unit: "s" },
				{ attribute: "confidence",   caption: "Confidence" },
				{ attribute: "probMobility", caption: "Mobility Prob." },
				{ attribute: "probIndoor",   caption: "Indoor Prob." },
				// { attribute: "meanSpeed",    caption: "Speed",    unit: "km/h" },
			],

			sortAttribute: "msgId",
			sortDirection: SortableCollection.SORT_ASCENDING,

			width: "700px",
			height: "80%",

			bodyTemplate: bodyTemplate,

			/** @type {Session} */
			session: null,

			selectedResult: null,

			events: {
				"click .selectItem": "selectResultClick",
			},

			initialize: function(options) {

				_.extend(this.events, TableDialogView.prototype.events);

				var session = options.session || null;

				if (session) {

					this.setSession(session);
				}

				this.selectedResult = options.selectedResult || null;

				TableDialogView.prototype.initialize.apply(this);
			},

			/**
			 * Update the session to be displayed.
			 * @param {Session} session
			 */
			setSession: function(session) {

				this.caption = "Records in Session " + session.get("sessionId");
				this.session = session;
			},

			/**
			 * Create a sortable collection with the extracted result "info"
			 */
			fillCollection: function() {

				var previousTime = this.session.results.length > 0 ? this.session.results.first().get('timestamp') : 0;
				var selectedResult = this.selectedResult;

				var infos = this.session.results.map(function(result) {
					var rv = result.getInfo();
					rv.selected = result === selectedResult;
					rv.timeDelta = rv.timestamp - previousTime;
					previousTime = rv.timestamp;
					return rv;
				});

				this.collection.reset(infos);
			},

			/**
			 * Handler for clicks on linkified result Ids.
			 * @param  {Event} evt The jQuery click event
			 */
			selectResultClick: function(evt) {
				evt.preventDefault();

				var linkElement = evt.currentTarget,
					strResultId = linkElement.textContent;

				this.trigger("search", new SearchQuery(SearchQuery.TOPIC_RESULT, strResultId));

				this.resetRowHighlights();
				this.highlightParentRow(linkElement);
			},
		});

		return ResultTableView;
	}
);