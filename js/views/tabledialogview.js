define(

	["jquery", "underscore", "backbone",
	 "collections/sortablecollection",
	 "hbs!templates/tabledialog"],

	function($, _, Backbone,
			 SortableCollection,
			 tableDialogTemplate) {

		var TableDialogView = Backbone.View.extend({

			constructor: function TableDialogView() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			// tag,ID for the autogenerated node the view will be enclosed in
			tagName: "div",
			className: "tableView",

			id: "",

			// the view caption
			caption: "",

			/**
			 * Column definitions as simple propertz hashes
			 * Supported attributes are: attribute, caption, unit, isSorted, dirDesc
			 * @type {Array}
			 */
			columns: null,

			sortAttribute: null,
			sortDirection: 0,

			width: "80%",
			height: "80%",

			/**
			 * The Handlebars template function for the "body" table.
			 * @param  {Object} context The template input data
			 * @return {String}         The HTML
			 */
			bodyTemplate: null,

			// array of the table column headers
			$tableHeaders: null,
			// the (scrolling) table with the data
			$tableBody: null,

			/** @type {SortableCollection} */
			collection: null,

			events: {
				"click #btnClose": "close",
				"click #btnHide": "hide",
				"click #btnSnap": "toggleSnapToSide",
				"click th": "headerClick",
			},

			initialize: function() {

				this.collection = new SortableCollection();

				this.fillCollection();

				this.collection.setSortAttribute(this.sortAttribute)
							   .setSortDirection(this.sortDirection)
							   .sort();

				this.render();

				this.listenTo(this.collection, "sort", this.updateTable);
			},

			/**
			 * Create a sortable collection with the extracted data.
			 * Override in your child view.
			 */
			fillCollection: function() {
			},

			// create the dialog and insert into page DOM
			render: function() {

				var context = {
					title: this.caption,
					columns: this.columns,
					width: this.width,
					height: this.height,
				};

				this.$el.html(tableDialogTemplate(context));
				$(document.body).append(this.$el);

				this.$tableHeaders = this.$("#tableHead th");
				this.$tableBody = this.$("#tableBody tbody");

				this.updateTable();

				return this;
			},

			// Update the dialog header element with the current caption.
			renderCaption: function() {
				this.$("#tableCaption").html(this.caption);
			},

			// Render the table body with the current sort configuration.
			updateTable: function() {

				if (this.$tableBody !== null) {

					// convert Models to JS objects
					var data = this.collection.map(function(info) {
						return info.toJSON();
					});

					var context = {
						tablerows: data,
					};

					this.$tableBody.html(this.bodyTemplate(context));
				}

				return this;
			},

			/**
			 * Remove all sort indication decoration classes from the column headers.
			 */
			resetHeaderClasses: function() {

				this.$tableHeaders.removeClass("sorted descending");
			},

			/**
			 * Remove highlight class from all rows.
			 */
			resetRowHighlights: function() {

				var $rows = this.$(".highlighted");
				$rows.removeClass("highlighted");
			},

			/**
			 * Applies the highlight class to the row containing the given element.
			 * @param  {Element} element The DOM node of the table child
			 */
			highlightParentRow: function(element) {

				if (!element)
					return;

				// walk up the DOM tree and look for the table row (TR)
				var rowElement = element.parentElement;
				while (rowElement !== null && rowElement.tagName !== "TR") {
					rowElement = rowElement.parentElement;
				}

				if (rowElement)
					rowElement.classList.add("highlighted");
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

						$(el).toggleClass("descending");
					}
					else {
						this.collection.setSortAttribute(sortAttr)
									   .setSortDirection(SortableCollection.SORT_DESCENDING)
									   .sort();

						this.resetHeaderClasses();
						el.classList.add("sorted");
						el.classList.add("descending");
					}
				}
			},

			/**
			 * Redisplays the popup dialog. The collection is updated to include all sessions.
			 */
			reshow: function() {

				this.fillCollection();
				this.updateTable();
				this.renderCaption();
				this.$el.show();
			},

			/**
			 * Temporarily hides the popup view, retaining state.
			 */
			hide: function() {

				this.$el.hide();
			},

			/**
			 * Temporarily hides the popup view, retaining state.
			 */
			toggleSnapToSide: function() {

				this.$(".dialog").toggleClass("snapRight");
				this.$("#btnSnap").toggleClass("active");
			},

			/**
			 * Closes the popup view, and destroys it.
			 */
			close: function() {

				this.trigger("dialog:cancel");
				this.remove();
			},
		});

		return TableDialogView;
	}
);