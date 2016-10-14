( function(){

	'use strict';

	var Promise = require('bluebird');
	var git = require('../lib/git');
	var execWrapper = require('../lib/exec-wrapper');
	var fs = require('fs');
	var nodeScanner = require('license-checker');
	var bowerScanner = require('bower-license');
	var _ = require('lodash');
	var path = require('path');
	var csvwriter = require('csvwriter');

	var LICENSE_SUPPLEMENTS_FILE_PATH	= "./config/license-supplements.json";
	var _licenseSupplements = _loadLicenseSupplementsFile( LICENSE_SUPPLEMENTS_FILE_PATH );

	exports.getRepoInfo = function(){
		return git.info();
	};

	function execErrorHandler( result ){
		if( result && (result.code !== 0 || result.error) ){
			var message = false;
			if( result.error ){
				message = result.error.message;
			}else{
				message = "Exit code=" + result.code + " " + result.stderr;
			}
			throw new Error( "exec " + result.command + ": " + message );
		}
	}

	exports.updateNodeDependencies = function(){
		return execWrapper.runCommand('npm', 'install')
		.then( execErrorHandler )
		.then( function(){
			return execWrapper.runCommand('npm', 'prune')
		})
		.then( execErrorHandler );

	};

	exports.updateBowerDependencies = function(){
		return execWrapper.runCommand('bower', 'install')
		.then( execErrorHandler )
		.then( function(){
			return execWrapper.runCommand('bower', 'prune')
		})
		.then( execErrorHandler );
	};

	exports.isNodeProject = function(){
		return fs.existsSync('package.json');
	};

	exports.isBowerProject = function(){
		return fs.existsSync('bower.json');
	};

	exports.scanForNodeDependencies = function(){
		var output = [];
		return _scanForNodeDependencies( { production: true })
		.then( function( dependencies ){
			output = output.concat( dependencies );
		})
		.then( function(){
			return _scanForNodeDependencies( { development: true });
		})
		.then( function( dependencies ){
			output = output.concat( dependencies );
		})
		.then( function(){
			if( _licenseSupplements && _licenseSupplements.node ){
				_supplementUknownDependencies( output, _licenseSupplements.node );
			}
		})
		.then( function(){
			return output;
		})
	};

	exports.scanForBowerDependencies = function(){
		var output = [];

		return _scanForBowerDependencies()
		.then( function( dependencies ){
			output = dependencies;
			if( _licenseSupplements && _licenseSupplements.bower ){
				_supplementUknownDependencies( output, _licenseSupplements.bower );
			}
		})
		.then( function(){
			return output;
		})
	};

	exports.writeDependencyCSV = function( filename, dependencies ){
		return new Promise( function( resolve, reject ){
			csvwriter( dependencies, function( error, csv ){
				if( error ) return reject( error );

				try{
					fs.writeFileSync( filename, csv, { encoding: 'utf8' });
				}catch( error ){
					reject( error );
				}

				resolve();
			});
		});
	};


	function _scanForNodeDependencies( options ){
		var topLevelNodeModulesFolder = process.cwd();
		options = _.extend({
			start: topLevelNodeModulesFolder,
			unknown: true
		}, options );

		const isProduction = options.production;

		return new Promise( function( resolve, reject ){
			nodeScanner.init( options, function( error, dependencies ){
				if( error ) return reject( error );

				resolve( _formatNodeDependencies( dependencies, topLevelNodeModulesFolder, isProduction) );
			});
		});
	}

	function _scanForBowerDependencies(){
		var topLevelBowerModulesFolder = process.cwd();

		return new Promise( function( resolve, reject ){
			bowerScanner.init( topLevelBowerModulesFolder, function( dependencies, error ){
				if( error ) return reject( error );

				resolve( _formatBowerDependencies( dependencies ) );
			} );
		});

	}

	function _formatNodeDependencies( dependencies, topLevelFolder, isProduction ){
		var topNodeModulesPath = path.join( topLevelFolder, "node_modules" ) + path.sep;

		var output = [];
		_.each( dependencies, function( dependencySpec, dependencyName ){
			var remainingPath = dependencySpec.dependencyPath.substring( topNodeModulesPath.length );
			output.push({
				name: dependencyName,
				path: remainingPath,
				email: dependencySpec.email,
				licenses: dependencySpec.licenses,
				publisher: dependencySpec.publisher,
				repo: dependencySpec.repository,
				depth: remainingPath.split( path.sep ).length,
				isProduction: isProduction
			});
		});
		return output;
	}

	function _formatBowerDependencies( dependencies ){
		var output = [];
		_.each( dependencies, function( dependencySpec, dependencyName ){
			var repo = dependencySpec.repository;
			if( typeof repo === "object" ){
				if( repo.url ) repo = repo.url;
				else repo = JSON.stringify( repo );
			}
			output.push({
				name: dependencyName,
				path: "",
				email: "",
				licenses: dependencySpec.licenses,
				publisher: "",
				repo: repo,
				depth: 1,
				isProduction: true
			});
		});
		return output;
	}


	function _loadLicenseSupplementsFile( filepath ){
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
			console.error( "Failed to parse license supplement file:" + filepath );
			return false;
		}

		return jsondata;
	}

	function _supplementUknownDependencies( dependencies, supplements ){
		_.each( dependencies, function( dependency ){
			if( dependency.licenses === "UNKNOWN" ){
				if( supplements[ dependency.name ] ){
					dependency.licenses = supplements[ dependency.name ];
				}
			}
		});
	}

})();