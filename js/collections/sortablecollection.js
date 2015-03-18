define(
	["underscore", "backbone"],

	function(_, Backbone) {

		/**
		 * A sortable Backbone.Collection.
		 * The collection can be sorted by any Model attribute in ascending/descending order.
		 *
		 * see: http://www.benknowscode.com/2013/01/creating-sortable-tables-with-backbone_8752.html
		 */
		var SortableCollection = Backbone.Collection.extend({

			sortAttribute: "",

			sortDirection: null,

			constructor: function SortableCollection() {
				Backbone.Collection.prototype.constructor.apply(this, arguments);
			},

			initialize: function() {
				this.sortDirection = SortableCollection.SORT_ASCENDING;
			},

			/**
			 * Sets the sort attribute.
			 * Does not update the collection order. Call sort() to apply the changes.
			 * @param  {String} attribute   The attribute name
			 * @return {SortableCollection} The collection
			 */
			setSortAttribute: function(attribute) {
				this.sortAttribute = attribute;
				return this;
			},

			/**
			 * Sets the sort direction.
			 * Does not update the collection order. Call sort() to apply the changes.
			 * @param  {number} direction   One of SORT_ASCENDING, SORT_DESCENDING
			 * @return {SortableCollection} The collection
			 */
			setSortDirection: function(direction) {

				if (direction === SortableCollection.SORT_ASCENDING || direction === SortableCollection.SORT_DESCENDING)
					this.sortDirection = direction;

				return this;
			},

			/**
			 * Flips the sort direction.
			 * Does not update the collection order. Call sort() to apply the changes.
			 * @return {SortableCollection} The collection
			 */
			invertDirection: function() {
				this.sortDirection *= -1;
				return this;
			},

			comparator: function(lhs, rhs) {

				if (this.sortAttribute === null || this.sortAttribute.length === 0)
					return 0;

				var a = lhs.get(this.sortAttribute),
					b = rhs.get(this.sortAttribute);

				if (a === b) return 0;

				var rv;
				if (this.sortDirection === SortableCollection.SORT_ASCENDING) {
					if (a === undefined && b !== undefined)
						rv = -1;
					else if (a !== undefined && b === undefined)
						rv = 1;
					else
						rv = a > b ? 1 : -1;

					return rv;
				}

				if (a === undefined && b !== undefined)
					rv = 1;
				else if (a !== undefined && b === undefined)
					rv = -1;
				else
					rv = a < b ? 1 : -1;

				return rv;
			},
		},
		{
			SORT_ASCENDING: 1,
			SORT_DESCENDING: -1
		});

		return SortableCollection;
	}
);
