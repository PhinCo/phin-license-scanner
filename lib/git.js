( function(){

	'use strict';

	const execWrapper = require("./exec-wrapper");

	exports.isClean = function( directoryPath ){
		// git status --untracked-files=no --porcelain
		return execWrapper.runCommand( "git", ["status", "--untracked-files=no", "--porcelain"], { cwd: directoryPath })   // stdout will be empty if repo is clean
		.then( function( result ){
			return result.code === 0 && result.stdout.length === 0;
		});
	};

	exports.commitHash = function( directoryPath ){
		// git rev-parse HEAD
		return execWrapper.runCommand( "git", ["rev-parse", "HEAD"], { cwd: directoryPath })
		.then( function( result ){
			return result.stdout;
		});
	};

	exports.info = function( directoryPath ){
		const result = {};
		return exports.isClean( directoryPath )
		.then( function( repoIsClean ){
			result.isClean = repoIsClean;
			return exports.commitHash( directoryPath );
		}).then( function( hash ){
			result.hash = hash.trim();
			return result;
		})
	};

})();
