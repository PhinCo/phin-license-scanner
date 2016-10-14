( function(){

	'use strict';

	var Promise = require('bluebird');
	var git = require('../lib/git');
	var execWrapper = require('../lib/exec-wrapper');
	var fs = require('fs');

	exports.getRepoInfo = function(){
		return git.info();
	};

	exports.updateNodeDependencies = function(){
		if( !exports.isNodeProject() ) return;

		execWrapper.runCommand('npm', 'install')
		.then( function( result ){
			if( result.code !== 0 || result.error ){
				const message = (result.error) ? result.error.message : "Exit code = " + result.code + ";" + result.stderr;
				throw new Error( message );
			}
		})
	};

	exports.updateBowerDependencies = function(){
		if( !exports.isBowerProject() ) return;

		execWrapper.runCommand('bower', 'install')
		.then( function( result ){
			if( result.code !== 0 || result.error ){
				const message = (result.error) ? result.error.message : "Exit code = " + result.code + ";" + result.stderr;
				throw new Error( message );
			}
		})
	};

	exports.isNodeProject = function(){
		return fs.existsSync('package.json');
	};

	exports.isBowerProject = function(){
		return fs.existsSync('bower.json');
	};

})();