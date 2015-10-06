/* global requirejs: false, require: false */
requirejs.config({
	shim: {
		'jquery.csv': {
			deps: ['jquery']
		},
	},
	paths: {
		'jquery.csv': 'lib/jquery.csv',
		'jquery': 'lib/jquery-1.11.1',
		json2: 'lib/hbs/json2',
		i18nprecompile: 'lib/hbs/i18nprecompile',
		hbs: 'lib/hbs/hbs',
		handlebars: 'lib/handlebars',
		underscore: 'lib/underscore',
		backbone: 'lib/backbone',
		mousetrap: 'lib/mousetrap',
		'templates': '../templates',
		'data-index': '../data/data-index',
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

