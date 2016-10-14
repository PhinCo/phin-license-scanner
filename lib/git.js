( function(){

	'use strict';

	var execWrapper = require("./exec-wrapper");

	exports.isClean = function(){
		// git status --untracked-files=no --porcelain
		return execWrapper.runCommand( "git", ["status", "--untracked-files=no", "--porcelain"] )   // stdout will be empty is repo is clean
		.then( function( result ){
			return result.code === 0 && result.stdout.length === 0;
		});
	};

	exports.commitHash = function(){
		// git rev-parse HEAD
		return execWrapper.runCommand( "git", ["rev-parse", "HEAD"] )
		.then( function( result ){
			return result.stdout;
		});
	};

	exports.info = function(){
		var result = {};
		return exports.isClean()
		.then( function( repoIsClean ){
			result.isClean = repoIsClean;
			return exports.commitHash();
		}).then( function( hash ){
			result.hash = hash.trim();
			return result;
		})
	}

})();