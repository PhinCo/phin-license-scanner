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
		if( !exports.isNodeProject() ) return;

		return execWrapper.runCommand('npm', 'install')
		.then( execErrorHandler )
		.then( function(){
			return execWrapper.runCommand('npm', 'prune')
		})
		.then( execErrorHandler );

	};

	exports.updateBowerDependencies = function(){
		if( !exports.isBowerProject() ) return;

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
			return output;
		})
	};

	function _scanForNodeDependencies( options ){
		var topLevelNodeModulesFolder = path.join( process.cwd() );
		options = _.extend({
			start: topLevelNodeModulesFolder,
			unknown: true
		}, options );

		const isProduction = options.production;

		return new Promise( function( resolve, reject ){
			nodeScanner.init( options, function(error, dependencies){
				if( error ) return reject( error );

				resolve( _formatNodeDependencies( dependencies, topLevelNodeModulesFolder, isProduction) );
			});
		});
	}

	function _formatNodeDependencies( dependencies, topLevelFolder, isProduction ){
		var topNodeModulesPath = path.join( topLevelFolder, "node_modules" ) + path.sep;

		var output = [];
		_.each( dependencies, function( dependencySpec, dependencyName ){
			var remainingPath = dependencySpec.dependencyPath.substring( topNodeModulesPath.length );
			output.push({
				dependency: dependencyName,
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

	exports.writeDependencyCSV = function( filename, dependencies ){
		return new Promise( function( resolve, reject ){
			csvwriter( dependencies, function( error, csv ){
				if( error ) return reject( error );

				fs.writeFileSync( filename, csv, { encoding: 'utf8' });
			});
		});
	}

})();