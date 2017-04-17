#!/usr/bin/env node

( function(){

	'use strict';

	var program = require('commander');
	var ScanRunner = require('../lib/DirectoryScanRunner');
	var _ = require('lodash');
	var path = require('path');
	var fs = require('fs');
	require('colors');
	var VERSION = require('../package.json').version;
	var LICENSE_CONFIG_FILE_PATH = path.join( __dirname, "../config/license-config.json" );

	program
	.version( VERSION )
	.option('--enableUnclean', "Don't require repo to be clean, default is clean required")
	.option('--skipNode', "Don't scan for node dependencies, default is scan for node")
	.option('--skipBower', "Don't scan for bower dependencies, default is scan for bower")
	.option('--skipUpdate', "Skip updating node and bower dependencies before scan")
	.option('-d, --dev', 'Categorize all dependencies as development')
	.option('-p, --prod', 'Categorize all dependenceis as production')
	.option('-u, --unknowns', 'Log unknowns to the console as warnings')
	.option('--config [filepath]', 'Provide an alternate config file' )
	.option('-l, --list', 'List runners found in the config file')
	.option('-r, --run [runner-key]', 'Execute a runner')
	.option('--warningsOff', 'Suppress warning about licenses identified in the config file')
	.arguments("[directories]", "Default is cwd")
	.parse( process.argv );

	if( program.args.length === 0 ) program.args.push(".");
	if( program.dev && program.prod ){
		console.error("Can pass in only one of --dev or --prod");
		process.exit(1);
	}

	if( !program.config ) program.config = LICENSE_CONFIG_FILE_PATH;
	var options = {};

	if( program.dev) options.overideCategorization = 'dev';
	else if( program.prod ) options.overideCategorization = 'prod';

	options.enableUnclean = program.enableUnclean;
	options.skipNode = program.skipNode;
	options.skipBower = program.skipBower;
	options.skipUpdate = program.skipUpdate;
	options.unknowns = program.unknowns;
	options.warnings = !program.warningsOff;

	options.config = _loadLicenseConfigFile( program.config );

	function _loadLicenseConfigFile( filepath ){
		var filedata = false;
		var jsondata = false;

		try{
			filedata = fs.readFileSync( filepath, {encoding: 'utf8'} );
		}catch( error ){
			if( error.code === 'ENOENT' ) return false;
			throw error;
		}

		try{
			jsondata = JSON.parse( filedata );
		}catch( error ){
			console.error( "Failed to parse license config file:" + filepath );
			throw error;
		}

		console.log( "Config file loaded from: ".yellow + filepath );

		return jsondata;
	}

	if( program.list ){
		console.log("Runners");
		var runners = _.get( options.config, 'runners' );
		var runnerNames = _.keys( runners );
		if( _.size( runnerNames ) === 0 ){
			console.log( "no runners founds in the config file");
		}else{
			console.log( runnerNames.join('\n') );
		}
		process.exit(0);
	}

	if( program.run ){
		var runner = _.get( options.config.runners, program.run );
		if( !runner ){
			console.error(`Runner "${program.run}" not found in config file`);
			process.exit(1);
		}
		return ScanRunner.run( runner, options );
	}else{
		// TODO: merge scanDirectories and run
		return ScanRunner.scanDirectories( program.args, options );
	}

})();