#!/usr/bin/env node

( async function(){

	'use strict';

	const program = require('commander');
	const ScanRunner = require('../lib/Runner');
	const _ = require('lodash');
	const path = require('path');
	const fs = require('fs');
	const csvwriter = require('csvwriter');
	require('colors');

	const VERSION = require('../package.json').version;
	const LICENSE_CONFIG_FILE_PATH = path.join( __dirname, "../config/license-config.json" );
	const DEFAULT_OUTPUT_DIR = process.cwd();

	program
	.version( VERSION )
	.option('--enableUnclean', "Don't require repo to be clean, default is clean required")
	.option('--skipNode', "Don't scan for node dependencies, default is scan for node")
	.option('--skipBower', "Don't scan for bower dependencies, default is scan for bower")
	.option('--skipUpdate', "Skip updating node and bower dependencies before scan")
	.option('-d, --dev', 'Categorize all dependencies as development')
	.option('-p, --prod', 'Categorize all dependencies as production')
	.option('-u, --unknowns', 'Log unknowns to the console as warnings')
	.option('--config [filepath]', 'Provide an alternate config file' )
	.option('-l, --list', 'List runners found in the config file')
	.option('-r, --run [runner-key]', 'Execute a runner')
	.option('-o, --output [outputDirectory]', `Output results in directory, default is ${DEFAULT_OUTPUT_DIR}`)
	.option('--warningsOff', 'Suppress warning about licenses identified in the config file')
	.arguments("[directories]", `Default is current working directory ${process.cwd()}`)
	.parse( process.argv );

	// default to current directory
	if( program.args.length === 0 ) program.args.push(".");

	if( program.dev && program.prod ){
		console.error("Can pass in only one of --dev or --prod");
		process.exit(1);
	}

	if( !program.config ) program.config = LICENSE_CONFIG_FILE_PATH;
	if( !program.output ) program.output = DEFAULT_OUTPUT_DIR;

	function _loadLicenseConfigFile( filepath ){
		let filedata = false;
		let jsondata = false;

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

	function _listRunners(){
		console.log( "Listing Runners in config file" );
		const runners = _.get( options.config, 'runners' );
		const runnerNames = _.keys( runners );
		if( _.size( runnerNames ) === 0 ){
			console.log( "no runners founds in the config file" );
		}else{
			console.log( runnerNames.join('\n') );
		}
	}

	function _buildRunner( options ){
		let runner = false;

		if( program.run ){
			runner = _.get( options, `config.runners[${program.run}]` );
			if( !runner ){
				console.error(`Runner "${program.run}" not found in config file`);
				process.exit(1);
			}
		}else{
			runner = ScanRunner.buildRunnerWithDirectoriesAndOptions( program.args, options );
		}
		return new ScanRunner( runner, options );
	}

	function _buildOptions( config ){
		const options = {};

		if( program.dev) options.overrideCategorization = 'dev';
		else if( program.prod ) options.overrideCategorization = 'prod';

		options.enableUnclean = program.enableUnclean;
		options.skipNode = program.skipNode;
		options.skipBower = program.skipBower;
		options.skipUpdate = program.skipUpdate;
		options.unknowns = program.unknowns;
		options.warnings = !program.warningsOff;
		options.output = program.output;

		options.config = config;

		return options;
	}

	async function outputDependencies(){
		const dependencies = runner.allDependencies();
		const filepath = path.join( program.output, 'phin-license-dependencies.csv' );

		csvwriter( dependencies, function( error, csv ){
			if( error ) return Promise.reject( error );

			try{
				console.log(`Writing ${dependencies.length} dependencies to ${filepath}`)
				fs.writeFileSync( filepath, csv, { encoding: 'utf8' });
			}catch( error ){
				Promise.reject( error );
			}

			Promise.resolve();
		});
	}
	/*
	 * Do It
	 */

	const config = _loadLicenseConfigFile( program.config );
	const options = _buildOptions( config );

	if( program.list ){
		_listRunners();
		return;
	}

	let runner = _buildRunner( options );

	try{
		await runner.run();
		console.log( "Done Scanning.".green );
		outputDependencies();
	}catch(error){
		console.log( "Failed", error );
	}

})();
