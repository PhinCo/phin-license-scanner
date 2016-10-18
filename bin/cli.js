#!/usr/bin/env node

( function(){

	'use strict';

	var Promise = require('bluebird');
	var program = require('commander');
	var Scanner = require('../lib/phin-license-scanner');
	var fs = require('fs');
	var path = require('path');
	var _ = require('lodash');
	require('colors');

	program
	.option('-c, --clean [clean]', 'Require repo to be clean {0|1}, default 1=true')
	.option('-n, --node [node]', 'Scan for node dependencies {0|1}, default 1=true')
	.option('-b, --bower [bower]', 'Scan for bower dependencies {0|1}, default 1=true')
	.option('-d, --dev', 'Categorize all dependencies as development')
	.option('-p, --prod', 'Categorize all dependenceis as production')
	.option('-u, --unknowns', 'Log unknowns to the console as warnings')
	.arguments("[directories]", "Default is cwd")
	.parse( process.argv );

	if( program.clean === void 0 ) program.clean = "1";
	if( program.node === void 0 ) program.node = "1";
	if( program.bower === void 0 ) program.bower = "1";
	if( program.args.length === 0 ) program.args.push(".");
	if( program.dev && program.prod ){
		console.error("Can pass in only one of --dev or --prod");
		process.exit(1);
	}
	if( program.dev) program.overideCategorization = 'dev';
	else if( program.prod) program.overideCategorization = 'prod';

	program.clean = parseInt( program.clean ) === 1;
	program.node = parseInt( program.node ) === 1;
	program.bower = parseInt( program.bower ) === 1;

	Promise.mapSeries( program.args, function( directoryPath ){
		return _performScanInDirectory( directoryPath );
	});

	function _performScanInDirectory( directoryPath ){

		return new Promise( function( resolve ){

			console.log( "Beginning scan of ".yellow + directoryPath.white );

			var scanner = new Scanner( directoryPath );

			_checkRepoState( scanner )
			.then( function(isRepoStatusOK){
				if( !isRepoStatusOK ){
					console.log( "Aborting." );
				}else{
					return _scanNodeDependencies( scanner )
					.then( function(){
						return _scanBowerDependencies( scanner );
					} )
				}
			})
			.then( function(){
				console.log( "Finished scan of ".yellow + directoryPath.white );
			})
			.catch( function(error){
				console.error( "Terminating scan of ".yellow + directoryPath.white );
			})
			.then( function(){
				resolve();
			});
		})

	}

	function _checkRepoState( scanner ){
		return scanner.getRepoInfo()
		.then( function(info){
			if( info.isClean ){
				console.log( "Repo is clean at commit hash ".yellow + info.hash );
				return true;
			}else{
				if( program.clean ){
					console.log( "Repo is not clean".red );
					return false;
				}
				console.log( "Continuing with dirty repo".yellow );
				return true;
			}
		} );
	}

	function _scanNodeDependencies( scanner ){
		return new Promise( function( resolve, reject ){
			var nodeDependencies = false;
			var bowerDependencies = false;

			if( !program.node ){
				console.log( "Skipping node scanning".yellow );
				return resolve();
			}

			if( !scanner.isNodeProject ){
				console.log( "Not a node project".yellow );
				return resolve();
			}

			console.log( "Updating node dependencies".yellow );

			return scanner.installNodeDependencies()
			.then( function(){
				console.log( "Scanning for node dependencies and licenses".yellow );
				return scanner.scanForNodeDependencies();
			})
			.then( function(dependencies){
				nodeDependencies = dependencies;
				if( program.overideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + program.overideCategorization );
					nodeDependencies = _overrideCategorization( nodeDependencies, program.overideCategorization );
				}
			})
			.then( function(){
				if( program.unknowns ){
					_logUknowns( nodeDependencies );
				}
			})
			.then( function(){
				console.log( "Node dependency scan complete. ".yellow + ("" + nodeDependencies.length + " found").white );
				console.log( "Writing node licenses file".yellow );
				return scanner.writeDependencyCSV( 'node_licence.csv', nodeDependencies );
			})
			.then( function(){
				resolve();
			})
			.catch( reject );
		});
	}

	function _scanBowerDependencies( scanner ){
		return new Promise( function( resolve, reject ){
			if( !program.bower ){
				console.log( "Skipping bower scanning in ".yellow + scanner.directory.white );
				return resolve();
			}

			if( !scanner.isBowerProject ){
				console.log( "Not a bower project".yellow );
				return resolve();
			}

			console.log( "Updating bower dependencies".yellow );

			return scanner.installBowerDependencies()
			.then( function(){
				console.log( "Scanning for bower dependencies and licenses".yellow );
				return scanner.scanForBowerDependencies();
			})
			.then( function(bowerDependencies){
				if( program.overideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + program.overideCategorization );
					bowerDependencies = _overrideCategorization( bowerDependencies, program.overideCategorization );
				}
				return bowerDependencies;
			})
			.then( function(bowerDependencies){
				console.log( "Bower dependency scan complete. ".yellow + ("" + bowerDependencies.length + " found").white );
				console.log( "Writing bower licenses file".yellow );
				return scanner.writeDependencyCSV( 'bower_licence.csv', bowerDependencies );
			})
			.then( function(){
				resolve();
			})
			.catch( reject );
		});
	}

	function _overrideCategorization( dependencies, toCategorization ){
		return _.map( dependencies, function( dependency ){
			dependency.isProduction = (toCategorization === 'prod' );
			return dependency;
		});
	}

	function _logUknowns( dependencies ){
		_.each( dependencies, function( dependency ){
			if( dependency.licenses === 'UNKNOWN' ){
				console.log("Unknown license: ".red + dependency.name.white + ", " + dependency.repo );
			}
		})
	}
})();