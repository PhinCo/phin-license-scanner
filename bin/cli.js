#!/usr/bin/env node

( function(){

	'use strict';

	var Promise = require('bluebird');
	var program = require('commander');
	var scanner = require('../lib/phin-license-scanner');
	var fs = require('fs');
	require('colors');

	program
	.option('-c, --clean [clean]', 'Require repo to be clean {0|1}, default 1=true')
	.option('-n, --node [node]', 'Scan for node dependencies {0|1}, default 1=true')
	.option('-b, --bower [bower]', 'Scan for bower dependencies {0|1}, default 1=true')
	.parse( process.argv );

	if( program.clean === void 0 ) program.clean = "1";
	if( program.node === void 0 ) program.node = "1";
	if( program.bower === void 0 ) program.bower = "1";

	program.clean = parseInt( program.clean ) === 1;
	program.node = parseInt( program.node ) === 1;
	program.bower = parseInt( program.bower ) === 1;

	_performScanInDirectory( "." );


	function _performScanInDirectory( path ){

		console.log( "Beginning scan of ".yellow + process.cwd().white );

		_checkRepoState()
		.then( function( isRepoStatusOK ){
			if( !isRepoStatusOK ){
				console.log("Aborting.");
			}else{
				return _scanNodeDependencies()
				.then( function(){
					return _scanBowerDependencies();
				})
			}
		})
		.then( function(){
			console.log("Finished scan of ".yellow + process.cwd().white );
		})
		.catch( function( error ){
			console.error("Terminating Scan.");
			throw error;
		});
	}

	//------------------------------------//

	function _checkRepoState(){
		return scanner.getRepoInfo()
		.then( function( info ){
			if( info.isClean ){
				console.log( "Repo is clean at commit hash ".yellow + info.hash );
				return true;
			}else{
				console.log( "Repo is not clean".yellow );
				if( program.clean ) return false;
				console.log( "Continuing with dirty repo" );
				return true;
			}
		});
	}

	function _scanNodeDependencies(){
		if( !program.node ) return console.log( "Skipping node scanning".yellow );

		console.log( "Checking if project is a node project".yellow );
		if( !scanner.isNodeProject() ) return console.log( "Not a node project".yellow );

		console.log( "Updating node dependencies".yellow );

		return scanner.updateNodeDependencies()
		.then( function(){
			console.log( "Scanning for node dependencies and licenses".yellow );
			return scanner.scanForNodeDependencies();
		})
		.then( function( nodeDependencies ){
			console.log( "Node dependency scan complete. ".yellow + ("" + nodeDependencies.length + " found").white );
			console.log( "Writing node licenses file".yellow );
			return scanner.writeDependencyCSV( 'node_licence.csv', nodeDependencies );
		})
	}

	function _scanBowerDependencies(){
		if( !program.bower ) return console.log("Skipping bower scanning".yellow );

		console.log("Checking if project is a bower project".yellow );
		if( !scanner.isBowerProject() ) return console.log("Not a bower project".yellow );

		console.log( "Updating bower dependencies".yellow );
		return scanner.updateBowerDependencies()
		.then( function(){
			console.log( "Scanning for bower dependencies and licenses".yellow );
			return scanner.scanForBowerDependencies();
		})
		.then( function( bowerDependencies ){
			console.log( "Bower dependency scan complete. ".yellow + ("" + bowerDependencies.length + " found").white );
			console.log( "Writing bower licenses file".yellow );
			return scanner.writeDependencyCSV( 'bower_licence.csv', bowerDependencies );
		});
	}


})();