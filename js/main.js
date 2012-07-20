requirejs.config({
	shim: {
		'jquery.csv': {
			deps: ['jquery']
		},
		'handlebars': {
			exports: 'Handlebars'
		},

		'underscore': {
			exports: '_'
		},
		'backbone': {
			deps: ['underscore', 'jquery'],
			exports: 'Backbone'
		},
	},
	paths: {
		'jquery.csv': 'lib/jquery.csv',
		handlebars: 'lib/handlebars',
		underscore: 'lib/underscore',
		backbone: 'lib/backbone',
	}
});

require(["views/appview"],
 function(AppView) {
	var app = new AppView();
});

