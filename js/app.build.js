({
	appDir: "../",
	// url to the scripts folder
	baseUrl: "js/",
	// output dir
	dir: "../../geolocviz-build",

	mainConfigFile: "./app-main.js",

	//Comment out the optimize line if you want
	//the code minified by UglifyJS
	// optimize: "uglify",
	optimize: "none",

	//Each script in the build layer will be turned into
	//a JavaScript string with a //@ sourceURL comment, and then wrapped in an
	//eval call. This allows some browsers to see each evaled script as a
	//separate script in the script debugger even though they are all combined
	//in the same file.
	useSourceUrl: true,

	//If set to true, any files that were combined into a build layer will be
	//removed from the output folder.
	removeCombined: true,

	// Don't copy .git folders and files into build output
	fileExclusionRegExp: /^\./,

	modules: [
		{
			name: "app-main",
			// Leave Backbone and dependencies (i.e. underscore) out of concatenation.
			// This resolves a conflict with the hbs plugin. */
			exclude: ['backbone']
		}
	]
})
