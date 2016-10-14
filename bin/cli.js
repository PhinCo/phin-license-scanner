( function(){

	'use strict';

	var program = require('commander');
	var Promise = require('bluebird');
	var scanner = require('../lib/phin-license-scanner');
	require('colors');

	program
	.option('-c, --clean [clean]', 'Require repo to be clean {0|1}, default 1=true')
	.parse( process.argv );

	if( program.clean === void 0 ) program.clean = "1";

	var scan = {};
	scan.requireCleanRepo = parseInt( program.clean ) === 1;

	/*****
	 * Begin Scan
	 */

	scan.cwd = process.cwd();
	console.log( "Beginning scan of ".yellow + scan.cwd.white );

	scanner.getRepoInfo()
	.then( function( info ){
		scan.repoInfo = info;
		if( scan.repoInfo.isClean ){
			console.log("Repo is clean at commit hash ".yellow + scan.repoInfo.commitHash );
		}else{
			console.log("Repo is not clean".yellow );
			if( scan.requireCleanRepo ){
				return _promptForDirtyRepo();
			}else{
				console.log("Continuing with dirty repo");
			}
		}
	})
	.then( function(){
		if( scanner.isNodeProject()){
			console.log("Updating node dependencies".yellow );
			return scanner.updateNodeDependencies();
		}

		console.log("Not a node project".yellow );
	})
	.then( function(){
		if( scanner.isBowerProject()){
			console.log( "Updating bower dependencies".yellow );
			return scanner.updateBowerDependencies();
		}

		console.log("Not a bower project".yellow );
	})
	.catch( function( error ){
		console.error( error );
		console.error("Terminating Scan");
	});


	function _promptForDirtyRepo(){
		/* Prompt user to continue with or without a git pull */
		return true;
	}
})();