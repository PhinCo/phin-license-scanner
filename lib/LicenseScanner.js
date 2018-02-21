( function(){

	'use strict';

	const Promise = require('bluebird');
	const git = require('../lib/git');
	const execWrapper = require('../lib/exec-wrapper');
	const fs = require('fs');
	const nodeScanner = require('license-checker');
	const bowerScanner = require('bower-license');
	const _ = require('lodash');
	const path = require('path');
	const utils = require('./utils');
	const csvwriter = require('csvwriter');

	function LicenseScanner( directory, config ){
		this.directory = path.resolve( directory );
		this.isNodeProject = _isNodeProject( directory );
		this.isBowerProject = _isBowerProject( directory );
		this.config = config;
	}

	LicenseScanner.prototype.getRepoInfo = async function(){
		return git.info( this.directory );
	};

	function execErrorHandler( result ){
		if( result && (result.code !== 0 || result.error) ){
			let message = false;
			if( result.error ){
				message = result.error.message;
			}else{
				message = "Exit code=" + result.code + " " + result.stderr;
			}
			throw new Error( "exec " + result.command + ": " + message );
		}
	}

	LicenseScanner.prototype.installNodeDependencies = async function(){
		const self = this;

		const installResult = await execWrapper.runCommand('npm', 'install', { cwd: self.directory });
		execErrorHandler(installResult);
		const pruneResult = await execWrapper.runCommand('npm', 'prune', { cwd: self.directory });
		execErrorHandler(pruneResult);

	};

	LicenseScanner.prototype.installBowerDependencies = async function(){
		const self = this;

		const installResult = await execWrapper.runCommand('bower', 'install', { cwd: self.directory });
		execErrorHandler(installResult);
		const pruneResult = await execWrapper.runCommand('bower', 'prune', { cwd: self.directory })
		execErrorHandler(pruneResult);
	};

	LicenseScanner.prototype.scanForNodeDependencies = async function(){
		const self = this;
		let output = [];

		const prodDependencies = await _scanForNodeDependencies( self.directory, { production: true });
		output = output.concat( prodDependencies );
		const devDependencies = await _scanForNodeDependencies( self.directory, { development: true });
		output = output.concat( devDependencies );

		if( self.config && self.config.node ){
			_overrideWithKnownLicenses( output, self.config.node );
			if( self.config.excludedDependencies ){
				output = _filterExcludedDependencies( output, self.config.excludedDependencies );
			}
		}

		return output;
	};

	LicenseScanner.prototype.scanForBowerDependencies = async function(){
		const self = this;

		const cwd = process.cwd();		// this bower scanner only works if run from project folder
		process.chdir( self.directory );

		let output = await _scanForBowerDependencies( self.directory );
		if( self.config && self.config.bower ){
			_overrideWithKnownLicenses( output, self.config.bower );
			if( self.config.excludedDependencies ){
				output = _filterExcludedDependencies( output, self.config.excludedDependencies );
			}
		}
		process.chdir( cwd );
		return output;
	};

	LicenseScanner.prototype.writeDependencyCSV = async function( filename, dependencies ){
		const filepath = path.join( this.directory, filename );
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


	async function _scanForNodeDependencies( fromDirectory, options ){

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

	async function _scanForBowerDependencies( fromDirectory ){

		return new Promise( function( resolve, reject ){
			bowerScanner.init( fromDirectory, function( dependencies, error ){
				if( error ) return reject( error );

				resolve( _formatBowerDependencies( dependencies ) );
			} );
		});

	}

	function _formatNodeDependencies( dependencies, topLevelFolder, isProduction ){
		const topNodeModulesPath = path.join( topLevelFolder, "node_modules" ) + path.sep;

		const output = [];
		_.each( dependencies, function( dependencySpec, dependencyName ){
			if( !dependencySpec.dependencyPath ) dependencySpec.dependencyPath = ".";
			const remainingPath = dependencySpec.dependencyPath.substring( topNodeModulesPath.length );
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
		let output = [];
		_.each( dependencies, function( dependencySpec, dependencyName ){
			let repo = dependencySpec.repository;
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
		const overridenLicenses = _.keys( overrides );
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
			const parsedName = utils.parseDependency( dependency.name );
			if( exclusions.indexOf( parsedName.dependency ) !== -1 ) return false;
			if( exclusions.indexOf( parsedName.registry ) !== -1 ) return false;
			if( exclusions.indexOf( parsedName.name) !== -1 ) return false;
			return true;
		});
	}

	module.exports = LicenseScanner;
})();
