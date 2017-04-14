( function(){

	var Promise = require('bluebird');
	var Scanner = require('../lib/phin-license-scanner');
	var fs = require('fs');
	var path = require('path');
	var _ = require('lodash');
	require('colors');

	function DirectoryScanRunner( directoryPath, options ){
		this.directoryPath = directoryPath;
		this.options = options;
		this.scanner = new Scanner( directoryPath, options.config );
	}

	DirectoryScanRunner.scanDirectories = function( directories, options ){

		Promise.mapSeries( directories, function( directoryPath ){
			return new DirectoryScanRunner( directoryPath, options ).perform();
		});

	};

	DirectoryScanRunner.prototype.perform = function(){
		var self = this;

		return new Promise( function( resolve ){

			console.log( "Beginning scan of ".yellow + self.directoryPath.white );
			console.log( "Config file loaded from: ".yellow + self.scanner.licenseConfig.filePath );

			self.checkRepoState()
			.then( function( isRepoStatusOK ){
				if( !isRepoStatusOK ){
					console.log( "Aborting." );
				}else{
					return self.scanNodeDependencies()
					.then( function(){
						return self.scanBowerDependencies();
					})
				}
			})
			.then( function(){
				console.log( "Finished scan of ".yellow + self.directoryPath.white );
			})
			.catch( function(error){
				console.error( "Terminating scan of ".yellow + self.directoryPath.white + ": ".white + error.message.red );
			})
			.then( function(){
				console.log("------------------------------------------");
				resolve();
			});
		})

	};

	DirectoryScanRunner.prototype.checkRepoState = function(){
		var self = this;
		return self.scanner.getRepoInfo()
		.then( function( info ){
			if( info.isClean ){
				console.log( "Repo is clean at commit hash ".yellow + info.hash );
				return true;
			}else{
				if( self.options.enableUnclean ){
					console.log( "Continuing with dirty repo".yellow );
					return true;
				}else {
					console.log( "Repo is not clean".red );
					return false;
				}
			}
		});
	};

	DirectoryScanRunner.prototype.updateNodeDependencies = function(){
		if( this.options.skipUpdate ) return Promise.resolve();
		else return this.scanner.installNodeDependencies();
	};

	DirectoryScanRunner.prototype.scanNodeDependencies = function(){
		var self = this;

		return new Promise( function( resolve, reject ){
			var nodeDependencies = false;

			if( self.options.skipNode ){
				console.log( "Skipping node scanning".yellow );
				return resolve();
			}

			if( !self.scanner.isNodeProject ){
				console.log( "Not a node project".yellow );
				return resolve();
			}

			console.log( "Updating node dependencies".yellow );

			self.updateNodeDependencies()
			.then( function(){
				console.log( "Scanning for node dependencies and licenses".yellow );
				return self.scanner.scanForNodeDependencies();
			})
			.then( function( dependencies ){
				nodeDependencies = dependencies;
				if( self.options.overideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + self.options.overideCategorization );
					nodeDependencies = self.overrideCategorization( nodeDependencies, self.options.overideCategorization );
				}
			})
			.then( function(){
				if( self.options.unknowns ){
					self.logUknowns( nodeDependencies );
				}
			})
			.then( function(){
				console.log( "Node dependency scan complete. ".yellow + ("" + nodeDependencies.length + " found").white );
				console.log( "Writing node licenses file".yellow );
				return self.scanner.writeDependencyCSV( 'node_license.csv', nodeDependencies );
			})
			.then( function(){
				resolve();
			})
			.catch( reject );
		});
	};

	DirectoryScanRunner.prototype.updateBowerDependencies = function(){
		if( this.options.skipUpdate ) return Promise.resolve();
		else return this.scanner.installBowerDependencies();
	};

	DirectoryScanRunner.prototype.scanBowerDependencies = function(){
		var self = this;

		return new Promise( function( resolve, reject ){
			var bowerDependencies = false;

			if( self.options.skipBower ){
				console.log( "Skipping bower scanning in ".yellow + self.scanner.directory.white );
				return resolve();
			}

			if( !self.scanner.isBowerProject ){
				console.log( "Not a bower project".yellow );
				return resolve();
			}

			console.log( "Updating bower dependencies".yellow );

			self.updateBowerDependencies()
			.then( function(){
				console.log( "Scanning for bower dependencies and licenses".yellow );
				return self.scanner.scanForBowerDependencies();
			})
			.then( function( dependencies ){
				bowerDependencies = dependencies
				if( self.options.overideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + self.options.overideCategorization );
					bowerDependencies = self.overrideCategorization( bowerDependencies, self.options.overideCategorization );
				}
			})
			.then( function(){
				if( self.options.unknowns ){
					self.logUknowns( bowerDependencies );
				}
			})
			.then( function(){
				console.log( "Bower dependency scan complete. ".yellow + ("" + bowerDependencies.length + " found").white );
				console.log( "Writing bower licenses file".yellow );
				return self.scanner.writeDependencyCSV( 'bower_license.csv', bowerDependencies );
			})
			.then( function(){
				resolve();
			})
			.catch( reject );
		});
	};

	DirectoryScanRunner.prototype.overrideCategorization = function( dependencies, toCategorization ){
		return _.map( dependencies, function( dependency ){
			dependency.isProduction = (toCategorization === 'prod' );
			return dependency;
		});
	};

	DirectoryScanRunner.prototype.logUknowns = function( dependencies ){
		_.each( dependencies, function( dependency ){
			if( dependency.licenses === 'UNKNOWN' ){
				console.log("Unknown license: ".red + dependency.name.white + ", " + dependency.repo );
			}
		})
	};

	module.exports = DirectoryScanRunner;
})();