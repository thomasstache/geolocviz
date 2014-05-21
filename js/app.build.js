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
			excludeShallow: ['data-index'],
		}
	]
})
