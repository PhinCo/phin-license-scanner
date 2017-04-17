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
	var utils = require('./utils');
	var csvwriter = require('csvwriter');

	function PhinLicenseScanner( directory, config ){
		this.directory = path.resolve( directory );
		this.isNodeProject = _isNodeProject( directory );
		this.isBowerProject = _isBowerProject( directory );
		this.config = config;
	}

	PhinLicenseScanner.prototype.getRepoInfo = function(){
		return git.info( this.directory );
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

	PhinLicenseScanner.prototype.installNodeDependencies = function(){
		var self = this;

		return execWrapper.runCommand('npm', 'install', { cwd: self.directory })
		.then( execErrorHandler )
		.then( function(){
			return execWrapper.runCommand('npm', 'prune', { cwd: self.directory })
		})
		.then( execErrorHandler );

	};

	PhinLicenseScanner.prototype.installBowerDependencies = function(){
		var self = this;

		return execWrapper.runCommand('bower', 'install', { cwd: self.directory })
		.then( execErrorHandler )
		.then( function(){
			return execWrapper.runCommand('bower', 'prune', { cwd: self.directory })
		})
		.then( execErrorHandler );
	};

	PhinLicenseScanner.prototype.scanForNodeDependencies = function(){
		var self = this;
		var output = [];

		return _scanForNodeDependencies( self.directory, { production: true })
		.then( function( dependencies ){
			output = output.concat( dependencies );
		})
		.then( function(){
			return _scanForNodeDependencies( self.directory, { development: true });
		})
		.then( function( dependencies ){
			output = output.concat( dependencies );
		})
		.then( function(){
			if( self.config && self.config.node ){
				_overrideWithKnownLicenses( output, self.config.node );
				if( self.config.excludedDependencies ){
					output = _filterExcludedDependencies( output, self.config.excludedDependencies );
				}
			}
		})
		.then( function(){
			return output;
		})
	};

	PhinLicenseScanner.prototype.scanForBowerDependencies = function(){
		var self = this;
		var output = [];

		var cwd = process.cwd();		// this bower scanner only works if run from project folder
		process.chdir( self.directory );

		return _scanForBowerDependencies( self.directory )
		.then( function( dependencies ){
			output = dependencies;
			if( self.config && self.config.bower ){
				_overrideWithKnownLicenses( output, self.config.bower );
				if( self.config.excludedDependencies ){
					output = _filterExcludedDependencies( output, self.config.excludedDependencies );
				}
			}
		})
		.then( function(){
			process.chdir( cwd );
			return output;
		})
	};

	PhinLicenseScanner.prototype.writeDependencyCSV = function( filename, dependencies ){
		var filepath = path.join( this.directory, filename );
		return new Promise( function( resolve, reject ){
			csvwriter( dependencies, function( error, csv ){
				if( error ) return reject( error );

				try{
					fs.writeFileSync( filepath, csv, { encoding: 'utf8' });
				}catch( error ){
					reject( error );
				}

				resolve();
			});
		});
	};

	function _isNodeProject( directory ){
		return fs.existsSync( path.join( directory, 'package.json'));
	}

	function _isBowerProject( directory ){
		return fs.existsSync( path.join( directory, 'bower.json'));
	}


	function _scanForNodeDependencies( fromDirectory, options ){

		options = _.extend({
			start: fromDirectory
		}, options );

		const isProduction = (options.production === true);

		return new Promise( function( resolve, reject ){
			nodeScanner.init( options, function( error, dependencies ){
				if( error ) return reject( error );

				resolve( _formatNodeDependencies( dependencies, fromDirectory, isProduction) );
			});
		});
	}

	function _scanForBowerDependencies( fromDirectory ){

		return new Promise( function( resolve, reject ){
			bowerScanner.init( fromDirectory, function( dependencies, error ){
				if( error ) return reject( error );

				resolve( _formatBowerDependencies( dependencies ) );
			} );
		});

	}

	function _formatNodeDependencies( dependencies, topLevelFolder, isProduction ){
		var topNodeModulesPath = path.join( topLevelFolder, "node_modules" ) + path.sep;

		var output = [];
		_.each( dependencies, function( dependencySpec, dependencyName ){
			if( !dependencySpec.dependencyPath ) dependencySpec.dependencyPath = ".";
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

	function _overrideWithKnownLicenses( dependencies, overrides ){
		var overridenLicenses = _.keys( overrides );
		_.each( dependencies, function( dependency ){
			if( overridenLicenses.indexOf( dependency.name ) !== -1){
				dependency.licenses = overrides[ dependency.name ];
			}
		});
	}

	/**
	 * Match incoming dependencies to excluded dependencies, by base name, excluding version
	 * @param dependencies
	 * @param exclusions
	 * @returns {Array}
	 * @private
	 *
	 * Known bug: doesn't match strings starting with @, such as @connectedyard/node-cli-auth
	 */
	function _filterExcludedDependencies( dependencies, exclusions ){
		return _.filter( dependencies, function( dependency ){
			var parsedName = utils.parseDependency( dependency.name );
			if( exclusions.indexOf( parsedName.dependency ) !== -1 ) return false;
			if( exclusions.indexOf( parsedName.registry ) !== -1 ) return false;
			if( exclusions.indexOf( parsedName.name) !== -1 ) return false;
			return true;
		});
	}

	module.exports = PhinLicenseScanner;
})();