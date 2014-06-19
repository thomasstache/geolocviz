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

			sortDirection: 1,

			sortByAttribute: function(attribute) {
				this.sortAttribute = attribute;
				this.sort();
			},

			comparator: function(lhs, rhs) {

				var a = lhs.get(this.sortAttribute),
					b = rhs.get(this.sortAttribute);

				if (a === b) return 0;

				if (this.sortDirection === SORTDIR.ASC) {
					return a > b ? 1 : -1;
				}

				return a < b ? 1 : -1;
			},
		});

		var SORTDIR = Object.freeze({ ASC: 1, DESC: -1, });

		return SortableCollection;
	}
);
