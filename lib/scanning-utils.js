( function(){

	'use strict';

	const git = require('../lib/git');
	const execWrapper = require('../lib/exec-wrapper');
	const fs = require('fs');
	const nodeScanner = require('license-checker');
	const bowerScanner = require('bower-license');
	const _ = require('lodash');
	const path = require('path');
	const utils = require('./utils');


	exports.getRepoInfo = async function( directoryPath ){
		return await git.info( directoryPath );
	};

	function _handleExecResult( result ){
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

	exports.installNodeDependencies = async function( directoryPath ){
		const installResult = await execWrapper.runCommand('npm', 'install', { cwd: directoryPath });
		_handleExecResult(installResult);
		const pruneResult = await execWrapper.runCommand('npm', 'prune', { cwd: directoryPath });
		_handleExecResult(pruneResult);
	};

	exports.installBowerDependencies = async function( directoryPath ){
		const installResult = await execWrapper.runCommand('bower', 'install', { cwd: directoryPath });
		_handleExecResult(installResult);
		const pruneResult = await execWrapper.runCommand('bower', 'prune', { cwd: directoryPath });
		_handleExecResult(pruneResult);
	};

	exports.scanForNodeDependencies = async function( directoryPath, licenseConfig ){
		let output = [];

		const prodDependencies = await _scanForNodeDependencies( directoryPath, { production: true });
		output = output.concat( prodDependencies );
		const devDependencies = await _scanForNodeDependencies( directoryPath, { development: true });
		output = output.concat( devDependencies );

		const nodeLicenseOverrides = _.get( licenseConfig, "node" );
		const excludedDependencies = _.get( licenseConfig, "excludedDependencies" );

		if( nodeLicenseOverrides ){
			_overrideWithKnownLicenses( output, nodeLicenseOverrides );
		}

		if( excludedDependencies ){
			output = _filterExcludedDependencies( output, excludedDependencies );
		}

		return output;
	};

	exports.scanForBowerDependencies = async function( directoryPath, licenseConfig ){
		const cwd = process.cwd();		// this bower scanner only works if run from project folder
		process.chdir( directoryPath );

		let output = await _scanForBowerDependencies( directoryPath );

		const bowerLicenseOverrides = _.get( licenseConfig, "bower" );
		const excludedDependencies = _.get( licenseConfig, "excludedDependencies" );

		if( bowerLicenseOverrides ){
			_overrideWithKnownLicenses( output, bowerLicenseOverrides );
		}

		if( excludedDependencies ){
			output = _filterExcludedDependencies( output, excludedDependencies );
		}

		process.chdir( cwd );
		return output;
	};

	exports.isNodeProject = function( directoryPath ){
		return fs.existsSync( path.join( directoryPath, 'package.json'));
	};

	exports.isBowerProject = function( directoryPath ){
		return fs.existsSync( path.join( directoryPath, 'bower.json'));
	};


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
})();
