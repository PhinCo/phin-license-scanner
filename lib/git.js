( function(){

	'use strict';

	const execWrapper = require("./exec-wrapper");

	exports.isClean = async function( directoryPath ){
		// git status --untracked-files=no --porcelain
		const result = await execWrapper.runCommand( "git", ["status", "--untracked-files=no", "--porcelain"], { cwd: directoryPath });   // stdout will be empty if repo is clean
		if( result.code === 0 && result.stdout.length === 0 ) return true;
		if( result.error ) throw result.error;
		return false;
	};

	exports.commitHash = async function( directoryPath ){
		// git rev-parse HEAD
		const result = await execWrapper.runCommand( "git", ["rev-parse", "HEAD"], { cwd: directoryPath });
		if( result.code === 0 && result.stdout ) return result.stdout.trim();
		if( result.error ) throw result.error;
		return null;
	};

	exports.getInfo = async function( directoryPath ){
		try{
			const isClean = await exports.isClean( directoryPath );
			const hash = await exports.commitHash( directoryPath );
			return { isClean, hash };
		}catch( error ){
			return null;
		}
	};

})();
