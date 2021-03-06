define(
	["backbone",
	 "data-index", "hbs!templates/filerepository"],

	function(Backbone, DataIndex, repositoryTemplate) {

		/**
		 * File Repository View.
		 * Emits the following events:
		 *   repository:fileselected
		 */
		var FileRepositoryView = Backbone.View.extend({

			constructor: function FileRepositoryView() {
				Backbone.View.prototype.constructor.apply(this, arguments);
			},

			el: $("#fileRepositoryView"),

			events: {
				"click #loadButton": "toggleFileList",
				"click .repositoryEntry": "fileSelected",
				"click .close-button": "hideFileList",
			},

			$fileRepositoryPanel: null,
			$loadButton: null,

			initialize: function() {
				this.$fileRepositoryPanel = this.$("#fileRepositoryPanel");
				this.$loadButton = this.$("#loadButton");
				this.render();
			},

			render: function() {

				var context = { options: DataIndex };
				this.$("#fileRepositoryList").html(repositoryTemplate(context));

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
				this.$fileRepositoryPanel.fadeToggle(100);
				this.$loadButton.toggleClass("active");
			},
			hideFileList: function() {
				this.$fileRepositoryPanel.hide();
				this.$loadButton.removeClass("active");
			}
		});

		return FileRepositoryView;
	}
);