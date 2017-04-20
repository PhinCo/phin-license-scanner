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
		this.scanner = new Scanner( this.directoryPath, this.options.config );
		this.dependencies = {};
	}

	DirectoryScanRunner.prototype.perform = function(){
		var self = this;

		return new Promise( function( resolve ){

			console.log( "Beginning scan of ".yellow + self.directoryPath.white );

			self.checkRepoState()
			.then( isRepoStatusOK => {
				if( !isRepoStatusOK ){
					console.log( "Aborting." );
				}else{
					return self.scanNodeDependencies()
					.then( function(){
						return self.scanBowerDependencies();
					})
				}
			})
			.then( () => {
				console.log( "Finished scan of ".yellow + self.directoryPath.white );
			})
			.catch( error => {
				console.error( "Terminating scan of ".yellow + self.directoryPath.white + ": ".white + error.message.red );
			})
			.then( () => {
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
			self.dependencies.node = [];

			if( !self.scanner.isNodeProject ){
				console.log( "Not a node project".yellow );
				return resolve();
			}

			if( self.options.skipNode ){
				console.log( "Skipping node scanning".yellow );
				return resolve();
			}

			console.log( "Updating node dependencies".yellow );

			self.updateNodeDependencies()
			.then( function(){
				console.log( "Scanning for node dependencies and licenses".yellow );
				return self.scanner.scanForNodeDependencies();
			})
			.then( dependencies => {
				self.dependencies.node = dependencies;
				if( self.options.overrideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + self.options.overrideCategorization );
					self.dependencies.node = self.overrideCategorization( self.dependencies.node, self.options.overrideCategorization );
				}
			})
			.then( () => {
				if( self.options.unknowns ){
					self.logUnknownDependencies( self.dependencies.node );
				}
			})
			.then( () => {
				if( self.options.warnings ){
					self.logWarningDependencies( self.dependencies.node );
				}
			})
			.then( () => {
				console.log( "Node dependency scan complete. ".yellow + ("" + self.dependencies.node.length + " found").white );
			})
			.then( () => {
				if( !self.options.nosave ){
					console.log( "Writing node licenses file".yellow );
					return self.scanner.writeDependencyCSV( 'node_license.csv', self.dependencies.node );
				}
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
			self.dependencies.bower = [];

			if( !self.scanner.isBowerProject ){
				console.log( "Not a bower project".yellow );
				return resolve();
			}

			if( self.options.skipBower ){
				console.log( "Skipping bower scanning in ".yellow + self.scanner.directory.white );
				return resolve();
			}

			console.log( "Updating bower dependencies".yellow );

			self.updateBowerDependencies()
			.then( function(){
				console.log( "Scanning for bower dependencies and licenses".yellow );
				return self.scanner.scanForBowerDependencies();
			})
			.then( function( dependencies ){
				self.dependencies.bower = dependencies;
				if( self.options.overrideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + self.options.overrideCategorization );
					self.dependencies.bower = self.overrideCategorization( self.dependencies.bower, self.options.overrideCategorization );
				}
			})
			.then( function(){
				if( self.options.unknowns ){
					self.logUnknownDependencies( self.dependencies.bower );
				}
			})
			.then( () => {
				if( self.options.warnings ){
					self.logWarningDependencies( self.dependencies.bower );
				}
			})
			.then( () => {
				console.log( "Bower dependency scan complete. ".yellow + ("" + self.dependencies.bower.length + " found").white );
			})
			.then( () => {
				if( !self.options.nosave ){
					console.log( "Writing bower licenses file".yellow );
					return self.scanner.writeDependencyCSV( 'bower_license.csv', self.dependencies.bower );
				}
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

	DirectoryScanRunner.prototype.logUnknownDependencies = function( dependencies ){
		_.each( dependencies, function( dependency ){
			if( dependency.licenses === 'UNKNOWN' ){
				console.log("Unknown license: ".red + dependency.name.white + ", " + dependency.repo );
			}
		})
	};

	DirectoryScanRunner.prototype.logWarningDependencies = function( dependencies ){
		var self = this;
		var warningLicenses = _.get( self.options, "config.warnOnLicenses" );
		if( _.size( warningLicenses ) === 0 ) return;

		function checkForWarning( licenses ){

			var raiseWarning = false;

			_.each( licenses, license => {
				_.each( warningLicenses, ( warningLicenseNode ) => {
					if( _.isString( warningLicenseNode && warningLicenseNode === license )){
						raiseWarning = true;
						return false;
					}else if( _.isObject( warningLicenseNode ) && warningLicenseNode.pattern && new RegExp( warningLicenseNode.pattern ).exec( license )){
						raiseWarning = true;
						return false;
					}
				});
				if( raiseWarning ) return false;
			});

			return raiseWarning;
		}

		_.each( dependencies, function( dependency ){
			if( dependency.licenses ){
				var licenses = dependency.licenses;
				if( !_.isArray( licenses )) licenses = [licenses];

				if( checkForWarning( licenses )){
					let warningLabel = (dependency.isProduction ) ? "Warning (Production): " : "Warning (Dev): ";
					console.log( warningLabel.red + dependency.name.white + ", " + dependency.repo + " uses licenses: " + licenses.join(',') );
				}
			}
		})
	};

	module.exports = DirectoryScanRunner;
})();