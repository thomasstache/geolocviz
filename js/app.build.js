({
	appDir: "../",
	// url to the scripts folder
	baseUrl: "js/",
	// output dir
	dir: "../../geolocviz-build",

	// Don't delete the build output folder to prevent churn
	// on assets in /images and /data
	keepBuildDir: true,

	mainConfigFile: "./app-main.js",

	//Comment out the optimize line if you want
	//the code minified by UglifyJS
	// optimize: "uglify",
	optimize: "none",

	//Specify build pragmas. If the source files contain comments like so:
	//>>excludeStart("fooExclude", pragmas.fooExclude);
	//>>excludeEnd("fooExclude");
	//Then the comments that start with //>> are the build pragmas.
	//excludeStart/excludeEnd and includeStart/includeEnd work, and
	//the pragmas value to the includeStart or excludeStart lines
	//is evaluated to see if the code between the Start and End pragma
	//lines should be included or excluded.
	pragmas: {
		debugExclude: true
	},

	//Each script in the build layer will be turned into
	//a JavaScript string with a //@ sourceURL comment, and then wrapped in an
	//eval call. This allows some browsers to see each evaled script as a
	//separate script in the script debugger even though they are all combined
	//in the same file.
	// useSourceUrl: true, // TS: don't use this for the moment, disables pragmas

	//If set to true, any files that were combined into a build layer will be
	//removed from the output folder.
	removeCombined: true,

	// Don't copy .git folders and files into build output
	fileExclusionRegExp: /^\./,

	modules: [
		{
			name: "app-main",
			excludeShallow: ['data-index'],
		}
	]
})
