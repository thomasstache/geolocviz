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
		json2: 'lib/hbs/json2',
		i18nprecompile: 'lib/hbs/i18nprecompile',
		hbs: 'lib/hbs/hbs',
		handlebars: 'lib/handlebars',
		underscore: 'lib/underscore',
		backbone: 'lib/backbone',
	},
	hbs: {
		disableI18n: true
	}
});

require(["views/appview"],
 function(AppView) {
	var app = new AppView();
});

