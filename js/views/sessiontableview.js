define(

	["jquery", "underscore", "backbone",
	 "views/tabledialogview",
	 "collections/sortablecollection", "collections/sessions",
	 "types/searchquery",
	 "hbs!templates/sessiontablerows"],

	function($, _, Backbone,
			 TableDialogView,
			 SortableCollection, SessionList, SearchQuery,
			 bodyTemplate) {

		var SessionTableView = TableDialogView.extend({

			constructor: function SessionTableView() {
				TableDialogView.prototype.constructor.apply(this, arguments);
			},

			id: "sessionTableDialog",

			caption: "All Sessions",

			columns: [
				{ attribute: "sessionId",    caption: "ID", isSorted: true, dirDesc: false, properties: { class: "firstCol" } },
				{ attribute: "resultCount",  caption: "Results" },
				{ attribute: "confidence",   caption: "Confidence" },
				{ attribute: "probMobility", caption: "Mobility Prob." },
				{ attribute: "probIndoor",   caption: "Indoor Prob." },
				{ attribute: "distance",     caption: "Distance", unit: "m" },
				{ attribute: "duration",     caption: "Duration", unit: "s" },
				{ attribute: "meanSpeed",    caption: "Speed",    unit: "km/h" },
			],

			sortAttribute: "sessionId",
			sortDirection: SortableCollection.SORT_ASCENDING,

			bodyTemplate: bodyTemplate,

			/** @type {SessionList} */
			sessions: null,

			selectedSession: null,

			events: {
				"click .selectSession": "selectSessionClick",
			},

			initialize: function(options) {

				_.extend(this.events, TableDialogView.prototype.events);

				var sessions = options.sessions || null;

				if (sessions) {
					this.sessions = sessions;
				}

				this.selectedSession = options.selectedSession || null;

				TableDialogView.prototype.initialize.apply(this);
			},

			/**
			 * Create a sortable collection with the extracted session "info"
			 */
			fillCollection: function() {

				var selectedSession = this.selectedSession;

				var infos = this.sessions.map(function(session) {
					var rv = session.getInfo();
					rv.selected = session === selectedSession;
					return rv;
				});

				this.collection.reset(infos);
			},

			/**
			 * Handler for clicks on linkified session Ids.
			 * @param  {Event} evt The jQuery click event
			 */
			selectSessionClick: function(evt) {
				evt.preventDefault();

				var linkElement = evt.currentTarget,
					strSessionId = linkElement.textContent;

				if (linkElement.dataset &&
					linkElement.dataset.uid !== undefined) {
					strSessionId = linkElement.dataset.uid;
				}

				this.trigger("search", new SearchQuery(SearchQuery.TOPIC_SESSION, strSessionId));

				this.resetRowHighlights();
				this.highlightParentRow(linkElement);
			},
		});

		return SessionTableView;
	}
);