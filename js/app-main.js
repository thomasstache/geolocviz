requirejs.config({
	shim: {
		'jquery.csv': {
			deps: ['jquery']
		},

		'backbone': {
			deps: ['underscore', 'jquery'],
			exports: 'Backbone'
		},

		'underscore': {
			exports: '_'
		},
	},
	paths: {
		'jquery.csv': 'lib/jquery.csv',
		'jquery': 'empty:',
		json2: 'lib/hbs/json2',
		i18nprecompile: 'lib/hbs/i18nprecompile',
		hbs: 'lib/hbs/hbs',
		handlebars: 'lib/handlebars',
		underscore: 'lib/underscore',
		backbone: 'lib/backbone',
	},
	hbs: {
		disableI18n: true,
		helperDirectory: '../templates/helpers/'
	}
});

require(["views/appview"],
 function(AppView) {
	var app = new AppView();
});

