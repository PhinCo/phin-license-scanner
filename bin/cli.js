#!/usr/bin/env node

( function(){

	'use strict';

	var program = require('commander');
	var scanner = require('../lib/phin-license-scanner');
	require('colors');

	program
	.option('-c, --clean [clean]', 'Require repo to be clean {0|1}, default 1=true')
	.option('-n, --node [node]', 'Scan for node dependencies {0|1}, default 1=true')
	.option('-b, --bower [bower]', 'Scan for bower dependencies {0|1}, default 1=true')
	.parse( process.argv );

	if( program.clean === void 0 ) program.clean = "1";
	if( program.node === void 0 ) program.node = "1";
	if( program.bower === void 0 ) program.bower = "1";

	var scan = {};
	scan.requireCleanRepo = parseInt( program.clean ) === 1;
	scan.includeNodeDependencies = parseInt( program.node ) === 1;
	scan.includeBowerDependencies = parseInt( program.bower ) === 1;

	/*****
	 * Begin Scan
	 */

	scan.cwd = process.cwd();
	console.log( "Beginning scan of ".yellow + scan.cwd.white );


	scanner.getRepoInfo()
	.then( function( info ){
		scan.repoInfo = info;
		if( scan.repoInfo.isClean ){
			console.log("Repo is clean at commit hash ".yellow + scan.repoInfo.hash );
		}else{
			console.log("Repo is not clean".yellow );
			if( scan.requireCleanRepo ){
				return _promptForDirtyRepo();
			}else{
				console.log("Continuing with dirty repo");
			}
		}
	})
	.then( function(){
		if( !scan.includeNodeDependencies ) return console.log( "Skipping node scanning".yellow );
		return _scanNodeDependencies();
	})
	.then( function(){
		if( !scan.includeBowerDependencies ) return console.log("Skipping bower scanning".yellow );
		return _scanBowerDependencies();
	})
	.then( function(){
		console.log("Done.".yellow );
	})
	.catch( function( error ){
		console.error( error );
		console.error("Terminating Scan.");
	});


	function _promptForDirtyRepo(){
		/* Prompt user to continue with or without a git pull */
		return true;
	}

	function _scanNodeDependencies(){
		console.log( "Checking if project is a node project".yellow );
		scan.isNodeProject = scanner.isNodeProject();
		if( !scan.isNodeProject ) return console.log( "Not a node project".yellow );

		console.log( "Updating node dependencies".yellow );

		return scanner.updateNodeDependencies()
		.then( function(){
			console.log( "Scanning for node dependencies and licenses".yellow );
			return scanner.scanForNodeDependencies();
		})
		.then( function( nodeDependencies ){
			console.log( "Node dependency scan complete. ".yellow + ("" + nodeDependencies.length + " found").white );
			scan.nodeDependencies = nodeDependencies;
		})
		.then( function(){
			console.log( "Writing node licenses file".yellow );
			return scanner.writeDependencyCSV( 'node_licence.csv', scan.nodeDependencies );
		})
	}

	function _scanBowerDependencies(){
		console.log("Checking if project is a bower project".yellow );
		scan.isBowerProject = scanner.isBowerProject() ;
		if( !scan.isBowerProject ) return console.log("Not a bower project".yellow );

		console.log( "Updating bower dependencies".yellow );
		return scanner.updateBowerDependencies()
		.then( function(){
			console.log( "Scanning for bower dependencies and licenses".yellow );
			return scanner.scanForBowerDependencies();
		})
		.then( function( bowerDependencies ){
			console.log( "Bower dependency scan complete. ".yellow + ("" + bowerDependencies.length + " found").white );
			scan.bowerDependencies = bowerDependencies;
		})
		.then( function(){
			console.log( "Writing bower licenses file".yellow );
			return scanner.writeDependencyCSV( 'bower_licence.csv', scan.bowerDependencies );
		});
	}


})();