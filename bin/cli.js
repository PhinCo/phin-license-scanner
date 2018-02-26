#!/usr/bin/env node

( async function(){

	'use strict';

	const program = require('commander');
	const LicenseScanner = require('../lib/LicenseScanner');
	const _ = require('lodash');
	const path = require('path');
	const fs = require('fs');
	const csvwriter = require('csvwriter');
	const loadJSON = require('../lib/load-json');
	require('colors');

	const VERSION = require('../package.json').version;
	const DEFAULT_OUTPUT_DIR = process.cwd();

	program
	.version( VERSION )
	.option('--config [filepath]', 'Provide an optional license config file' )
	.option('--run [filepath]', 'Provide an optional run configuration, defining directories and options for each')
	.option('-o, --output [outputFolder]', `Output results in directory, default is ${DEFAULT_OUTPUT_DIR}`)
	.option('--enableUnclean', "Don't require repo to be clean, default is clean required")
	.option('--skipNode', "Don't scan for node dependencies, default is scan for node")
	.option('--skipBower', "Don't scan for bower dependencies, default is scan for bower")
	.option('--skipUpdate', "Skip updating node and bower dependencies before scan")
	.option('-d, --dev', 'Categorize all dependencies as development')
	.option('-p, --prod', 'Categorize all dependencies as production')
	.arguments("[directories]", `Specify which directories to scan. By Default all directories found from --run [filepath] will be scanned. If no other directory is specified, scans current directory` )
	.parse( process.argv );

	if( program.dev && program.prod ){
		console.error("Can pass in only one of --dev or --prod");
		process.exit(1);
	}

	if( !program.output ) program.output = DEFAULT_OUTPUT_DIR;

	function _buildDirectoryOptions( directories, runConfig ){
		const masterOptions = {
			enableUnclean: program.enableUnclean,
			skipNode: program.skipNode,
			skipBower: program.skipBower,
			skipUpdate: program.skipUpdate
		};

		if( program.dev) masterOptions.overrideCategorization = 'dev';
		else if( program.prod ) masterOptions.overrideCategorization = 'prod';

		return directories.reduce( ( accumulator, directory ) => {
			if( !runConfig ) accumulator[directory] = masterOptions;
			else accumulator[directory] = _.extend( runConfig.directories[ directory ], masterOptions );
			return accumulator;
		}, {} );
	}

	function _buildListOfDirectories( directories, runConfig ){
		if( !runConfig && _.size( directories ) > 0 ) return [process.cwd()];
		if( !runConfig ) return directories;
		const runConfigDirectories = _.keys( runConfig.directories );
		if( _.size( runConfigDirectories ) === 0 ) throw new Error( `Run config file must specify directories` );
		if( _.size( directories ) === 0 ) return runConfigDirectories;
		return _.intersection( runConfigDirectories, directories );
	}

	function moduleList(){
		let aggregate = [];

		this.directoryNodes.forEach( directoryNode => {
			aggregate = aggregate.concat( directoryNode.allDependencies());
		});

		if( productionOnly ){
			aggregate = _.filter( aggregate, { isProduction: true } );
		}

		const listWithCleanNames = _.map( aggregate, dep =>{
			const cleanName = dep.name.split( '@' )[0];
			return {
				name: cleanName,
				publisher: dep.publisher,
				licenses: dep.licenses,
				email: dep.email,
				isProduction: dep.isProduction
			};
		});

		// Sort by name, then production, then dev
		// When uniq'ing this sorted list, production instance of duplication is retained in final output
		const sortedList = _.sortBy( listWithCleanNames, ["name", dep => -(dep.isProduction)] );
		return _.uniqWith( sortedList, ( a, b ) => a.name === b.name );
	}

	function fullDependencyList( results ){
		const output = [];


	}

	async function outputDependencies(){
		const dependencies = runner.allDependencies();
		const filePath = path.join( program.output, 'phin-license-dependencies.csv' );

		csvwriter( dependencies, function( error, csv ){
			if( error ) return Promise.reject( error );

			try{
				console.log(`Writing ${dependencies.length} dependencies to ${filePath}`)
				fs.writeFileSync( filePath, csv, { encoding: 'utf8' });
			}catch( error ){
				Promise.reject( error );
			}

			Promise.resolve();
		});
	}


	/*
	 * Do It
	 */

	let runConfig = false;
	let licenseConfig = false;

	if( program.run ) runConfig = loadJSON( program.run );
	if( program.config ) licenseConfig = loadJSON( program.config );

	const directories = _buildListOfDirectories( program.args, runConfig );
	const directoryOptions = _buildDirectoryOptions( directories, runConfig );

	const results = await LicenseScanner.scanDirectories( directories, directoryOptions, licenseConfig );

	// try{
	// 	await runner.run();
	// 	console.log( "Done Scanning.".green );
	// 	outputDependencies();
	// }catch(error){
	// 	console.log( "Failed", error );
	// }

})();
