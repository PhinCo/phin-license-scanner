#!/usr/bin/env node

( function(){

	'use strict';

	var program = require('commander');
	var ScanRunner = require('../lib/DirectoryScanRunner');
	var _ = require('lodash');
	require('colors');

	program
	.option('--enableUnclean', "Don't require repo to be clean, default is clean required")
	.option('--skipNode', "Don't scan for node dependencies, default is scan for node")
	.option('--skipBower', "Don't scan for bower dependencies, default is scan for bower")
	.option('--skipUpdate', "Skip updating node and bower dependencies before scan")
	.option('-d, --dev', 'Categorize all dependencies as development')
	.option('-p, --prod', 'Categorize all dependenceis as production')
	.option('-u, --unknowns', 'Log unknowns to the console as warnings')
	.option('--config [filepath]', 'Provide an alternate config file')
	.arguments("[directories]", "Default is cwd")
	.parse( process.argv );

	if( program.args.length === 0 ) program.args.push(".");
	if( program.dev && program.prod ){
		console.error("Can pass in only one of --dev or --prod");
		process.exit(1);
	}
	if( program.dev) program.overideCategorization = 'dev';
	else if( program.prod) program.overideCategorization = 'prod';

	return ScanRunner.scanDirectories( program.args, program );

})();