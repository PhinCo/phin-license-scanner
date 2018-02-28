#!/usr/bin/env node

( async function(){

	'use strict';

	const program = require('commander');
	const LicenseScanner = require('../lib/LicenseScanner');
	const scanningUtils = require('../lib/scanning-utils');
	const _ = require('lodash');
	const path = require('path');
	const fs = require('fs');
	const csvwriter = require('csvwriter');
	const utils = require('../lib/utils');
	require('colors');

	const VERSION = require('../package.json').version;
	// const HOMEDIR = require('os').homedir();
	const DEFAULT_OUTPUT_DIR = process.cwd();
	const DEFAULT_WORKING_DIR = process.cwd();
	const DEFAULT_LICENSE_CONFIG_PATH = path.join( process.cwd(), ".license-config.json");
	const DEFAULT_RUN_CONFIG_PATH = path.join( process.cwd(), ".run-config.json");

	program
	.version( VERSION )
	.option('-c, --config [filepath]', `Provide a license config file. By default loads from ${DEFAULT_LICENSE_CONFIG_PATH} if found` )
	.option('-w, --working [workingFolder]', `Run scan from directory. By default runs from ${DEFAULT_WORKING_DIR}`)
	.option('-r, --run [filepath]', `Provide a run config, defining directories and options for each. By default loads from ${DEFAULT_RUN_CONFIG_PATH}`)
	.option('-o, --output [outputFolder]', `Output results in directory. By default outputs to ${DEFAULT_OUTPUT_DIR}`)
	.option('-u, --enableUnclean', "Don't require repo to be clean, default is clean required")
	.option('-d, --dev', 'Categorize all dependencies as development')
	.option('-p, --prod', 'Categorize all dependencies as production')
	.option('--skipNode', "Don't scan for node dependencies, default is scan for node")
	.option('--skipBower', "Don't scan for bower dependencies, default is scan for bower")
	.option('--skipUpdate', "Skip updating node and bower dependencies before scan")
	.arguments("[directories]", `Specify which directories to scan. By Default all directories found from --run [filepath] will be scanned. If no other directory is specified, scans current directory` )
	.parse( process.argv );

	if( program.dev && program.prod ){
		console.error("Can pass in only one of --dev or --prod");
		process.exit(1);
	}

	if( !program.output ) program.output = DEFAULT_OUTPUT_DIR;
	if( !program.config ) program.config = DEFAULT_LICENSE_CONFIG_PATH;
	if( !program.run ) program.run = DEFAULT_RUN_CONFIG_PATH;
	if( !program.working ) program.working = DEFAULT_WORKING_DIR;

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
			else{
				const directoryOptionOverrides = runConfig.directories[ directory ];
				accumulator[directory] = _.extend( {}, masterOptions, directoryOptionOverrides );
			}
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

	/**
	 * Group dependencies by module
	 * @param dependenciesByDirectory
	 * @return {Array}
	 */


	async function writeDependenciesCSV( filePath, dependencies ){

		csvwriter( dependencies, (error, csv) => {
			if( error ) return Promise.reject( error );

			try{
				console.log(`Writing ${dependencies.length} dependencies to ${filePath}`);
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

	if( program.run ){
		runConfig = utils.loadJSON( program.run );
		if( runConfig ) console.log( `Loaded run config from ${program.run}` );
		else console.log( `Run config "${program.run}" not found. Continuing without one` );
	}

	if( program.config ){
		licenseConfig = utils.loadJSON( program.config );
		if( licenseConfig ) console.log( `Loaded run config from ${program.config}` );
		else console.log( `License config "${program.config}" not found. Continuing without one` );
	}

	const directories = _buildListOfDirectories( program.args, runConfig );
	const directoryOptions = _buildDirectoryOptions( directories, runConfig );

	const dependenciesByDirectory = await LicenseScanner.scanDirectories( directories, directoryOptions, licenseConfig, program.working );

	/*
 	 * Generate Reports
 	 */

	console.log(`\nWriting reports to ${program.output.yellow}\n`);

	const sortedDependencies = LicenseScanner.sortedMultiDirectoryDependencies( dependenciesByDirectory );

	const sortedProductionDependencies = _.filter( sortedDependencies, { isProduction: true } );
	const productionModuleList = _.map( _.uniqBy( sortedProductionDependencies, 'module' ), row =>
			_.pick( row, ['module', 'licenses', 'directory', 'publisher', 'repo', 'type' ] )
		);
	const unknowns = LicenseScanner.filterDependenciesWithUnknownLicenses( sortedDependencies );
	const warnings = LicenseScanner.filterDependenciesWithLicenseWarnings( sortedDependencies, licenseConfig );

	/*
	 * Write Report Files
	 */
	
	const allFilePath = path.join( program.output, 'dependencies-all.csv' );
	await writeDependenciesCSV( allFilePath, sortedDependencies );

	const prodFilePath = path.join( program.output, 'dependencies-prod.csv' );
	await writeDependenciesCSV( prodFilePath, sortedDependencies );

	const prodModuleListPath = path.join( program.output, 'dependencies-prod-modules.csv' );
	await writeDependenciesCSV( prodModuleListPath, productionModuleList );

	const waningLicenseListPath = path.join( program.output, 'dependencies-warnings.csv' );
	await writeDependenciesCSV( waningLicenseListPath, warnings );

	const unknownsLicenseListPath = path.join( program.output, 'dependencies-unknown.csv' );
	await writeDependenciesCSV( unknownsLicenseListPath, unknowns );


})();
