define(
	["backbone",
	 "../../data/data-index", "hbs!../../templates/filerepository"],

	function(Backbone, DataIndex, repositoryTemplate) {

		/**
		 * File Repository View.
		 * Emits the following events:
		 *   repository:fileselected
		 */
		var FileRepositoryView = Backbone.View.extend({
			el: $("#fileRepositoryView"),

			events: {
				"click #loadButton": "toggleFileList",
				"click .repositoryEntry": "fileSelected",
			},

			initialize: function() {
				this.$fileRepositoryList = this.$("#fileRepositoryList");
				this.render();
			},

			render: function() {

				var context = { options: DataIndex };
				this.$fileRepositoryList.html(repositoryTemplate(context));

				return this;
			},

			fileSelected: function(evt) {

				if (!(evt.currentTarget && evt.currentTarget.classList.contains("repositoryEntry")))
					return;

				var li = evt.currentTarget;
				if (li.dataset &&
					li.dataset.filename) {

					var filename = li.dataset.filename;

					this.trigger("repository:fileselected", filename);
				}

				this.hideFileList();
			},

			toggleFileList: function() {
				this.$fileRepositoryList.fadeToggle(100);
			},
			hideFileList: function() {
				this.$fileRepositoryList.hide();
			}
		});

		return FileRepositoryView;
	}
);