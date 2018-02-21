( function(){

	const Promise = require('bluebird');
	const Scanner = require('./LicenseScanner');
	const fs = require('fs');
	const path = require('path');
	const _ = require('lodash');
	require('colors');

	function DirectoryRunner( directoryPath, options ){
		this.directoryPath = directoryPath;
		this.options = options;
		this.scanner = new Scanner( this.directoryPath, this.options.config );
		this.dependencies = {};
	}

	DirectoryRunner.prototype.perform = async function(){
		const self = this;

		try{
			console.log( "Beginning scan of ".yellow + self.directoryPath.white );

			const isRepoStatusOK = await self.checkRepoState();
			if( !isRepoStatusOK ){
				console.log( "Aborting." );
			}else{
				await self.scanNodeDependencies();
				await self.scanBowerDependencies();
			}
			console.log( "Finished scan of ".yellow + self.directoryPath.white );
		}catch(error){
			console.error( "Terminating scan of ".yellow + self.directoryPath.white + ": ".white + error.message.red );
		}
		console.log( "------------------------------------------" );

		return this.dependencies;
	};

	DirectoryRunner.prototype.checkRepoState = async function(){
		const self = this;
		const info = await self.scanner.getRepoInfo();
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
	};

	DirectoryRunner.prototype.updateNodeDependencies = async function(){
		if( this.options.skipUpdate ) return;
		return await this.scanner.installNodeDependencies();
	};

	DirectoryRunner.prototype.scanNodeDependencies = async function(){
		const self = this;

		self.dependencies.node = [];

		if( !self.scanner.isNodeProject ){
			console.log( "Not a node project".yellow );
			return;
		}

		if( self.options.skipNode ){
			console.log( "Skipping node scanning".yellow );
			return;
		}

		console.log( "Updating node dependencies".yellow );

		await self.updateNodeDependencies();

		console.log( "Scanning for node dependencies and licenses".yellow );
		self.dependencies.node = await self.scanner.scanForNodeDependencies();
		if( self.options.overrideCategorization ){
			console.log( "Overriding dependency categorization as ".yellow + self.options.overrideCategorization );
			self.dependencies.node = self.overrideCategorization( self.dependencies.node, self.options.overrideCategorization );
		}

		if( self.options.unknowns ){
			self.logUnknownDependencies( self.dependencies.node );
		}

		if( self.options.warnings ){
			self.logWarningDependencies( self.dependencies.node );
		}

		console.log( "Node dependency scan complete. ".yellow + ("" + self.dependencies.node.length + " found").white );

		// if( !self.options.nosave ){
		// 	console.log( "Writing node licenses file".yellow );
		// 	return self.scanner.writeDependencyCSV( 'node_license.csv', self.dependencies.node );
		// }
	};

	DirectoryRunner.prototype.updateBowerDependencies = function(){
		if( this.options.skipUpdate ) return Promise.resolve();
		else return this.scanner.installBowerDependencies();
	};

	DirectoryRunner.prototype.scanBowerDependencies = async function(){
		const self = this;

		self.dependencies.bower = [];

		if( !self.scanner.isBowerProject ){
			console.log( "Not a bower project".yellow );
			return;
		}

		if( self.options.skipBower ){
			console.log( "Skipping bower scanning in ".yellow + self.scanner.directory.white );
		}

		console.log( "Updating bower dependencies".yellow );

		await self.updateBowerDependencies();
		console.log( "Scanning for bower dependencies and licenses".yellow );
		self.dependencies.bower = await self.scanner.scanForBowerDependencies();

		if( self.options.overrideCategorization ){
			console.log( "Overriding dependency categorization as ".yellow + self.options.overrideCategorization );
			self.dependencies.bower = self.overrideCategorization( self.dependencies.bower, self.options.overrideCategorization );
		}

		if( self.options.unknowns ){
			self.logUnknownDependencies( self.dependencies.bower );
		}

		if( self.options.warnings ){
			self.logWarningDependencies( self.dependencies.bower );
		}

		console.log( "Bower dependency scan complete. ".yellow + ("" + self.dependencies.bower.length + " found").white );

		// if( !self.options.nosave ){
		// 	console.log( "Writing bower licenses file".yellow );
		// 	return self.scanner.writeDependencyCSV( 'bower_license.csv', self.dependencies.bower );
		// }

	};

	DirectoryRunner.prototype.overrideCategorization = function( dependencies, toCategorization ){
		return _.map( dependencies, function( dependency ){
			dependency.isProduction = (toCategorization === 'prod' );
			return dependency;
		});
	};

	DirectoryRunner.prototype.logUnknownDependencies = function( dependencies ){
		_.each( dependencies, function( dependency ){
			if( dependency.licenses === 'UNKNOWN' ){
				console.log("Unknown license: ".red + dependency.name.white + ", " + dependency.repo );
			}
		})
	};

	DirectoryRunner.prototype.logWarningDependencies = function( dependencies ){
		const self = this;
		const warningLicenses = _.get( self.options, "config.warnOnLicenses" );
		if( _.size( warningLicenses ) === 0 ) return;

		function checkForWarning( licenses ){

			let raiseWarning = false;

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
				let licenses = dependency.licenses;
				if( !_.isArray( licenses )) licenses = [licenses];

				if( checkForWarning( licenses )){
					let warningLabel = (dependency.isProduction ) ? "Warning (Production): " : "Warning (Dev): ";
					console.log( warningLabel.red + dependency.name.white + ", " + dependency.repo + " uses licenses: " + licenses.join(',') );
				}
			}
		})
	};

	module.exports = DirectoryRunner;
})();
