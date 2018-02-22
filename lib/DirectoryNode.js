( function(){

	const LicenseScanner = require('./LicenseScanner');
	const _ = require('lodash');
	require('colors');

	class DirectoryNode {
		constructor( directoryPath, options ){
			this.directoryPath = directoryPath;
			this.options = options;
			this.dependencies = {};
			this.licenseScanner = new LicenseScanner( this.directoryPath, this.options.config );
		}

		log( message ){
			console.log( this.directoryPath.white + ": " + message );
		}

		allDependencies(){
			return this.dependencies.bower.concat( this.dependencies.node );
		}

		async isRepoStatusOK(){
			this.log( "Inspecting Repo".yellow );
			const info = await this.licenseScanner.getRepoInfo();
			if( !info ) return false;

			if( info.isClean ){
				this.log( "Repo is clean at commit hash ".green + info.hash.white );
				return true;
			}else{
				if( this.options.enableUnclean ){
					this.log( "Continuing with dirty repo".yellow );
					return true;
				}else{
					this.log( "Repo is not clean".red );
					return false;
				}
			}
		}

		async performScan(){
			try{
				if( this.isRepoStatusOK() ){
					await this.scanNodeDependencies();
					await this.scanBowerDependencies();
					this.log( "Finished".green );
				}
			}catch( error ){
				this.log( "Error: ".yellow + error.message.red );
				this.log( "Aborted".yellow );
			}
		}

		async updateNodeDependencies(){
			if( this.options.skipUpdate ) return;
			return await this.licenseScanner.installNodeDependencies();
		}

		async scanNodeDependencies(){
			this.dependencies.node = [];

			if( !this.licenseScanner.isNodeProject ){
				this.log( "Not a node project".yellow );
				return;
			}

			if( this.options.skipNode ){
				this.log( "Skipping node scanning".yellow );
				return;
			}

			this.log( "Updating node dependencies".yellow );

			await this.updateNodeDependencies();

			this.log( "Scanning for node dependencies and licenses".yellow );
			this.dependencies.node = await this.licenseScanner.scanForNodeDependencies();
			if( this.options.overrideCategorization ){
				this.log( "Overriding dependency categorization as ".yellow + this.options.overrideCategorization );
				this.dependencies.node = this.overrideCategorization( this.dependencies.node, this.options.overrideCategorization );
			}

			if( this.options.unknowns ){
				this.logUnknownDependencies( this.dependencies.node );
			}

			if( this.options.warnings ){
				this.logWarningDependencies( this.dependencies.node );
			}

			this.log( "Node dependency scan complete. ".yellow + ("" + this.dependencies.node.length + " found").white );

			// if( !self.options.nosave ){
			// 	console.log( "Writing node licenses file".yellow );
			// 	return self.licenseScanner.writeDependencyCSV( 'node_license.csv', self.dependencies.node );
			// }
		}

		async updateBowerDependencies(){
			if( this.options.skipUpdate ) return;
			return await this.licenseScanner.installBowerDependencies();
		}

		async scanBowerDependencies(){
			this.dependencies.bower = [];

			if( !this.licenseScanner.isBowerProject ){
				this.log( "Not a bower project".yellow );
				return;
			}

			if( this.options.skipBower ){
				this.log( "Skipping bower scanning in ".yellow + this.licenseScanner.directory.white );
			}

			this.log( "Updating bower dependencies".yellow );

			await this.updateBowerDependencies();
			this.log( "Scanning for bower dependencies and licenses".yellow );
			this.dependencies.bower = await this.licenseScanner.scanForBowerDependencies();

			if( this.options.overrideCategorization ){
				this.log( "Overriding dependency categorization as ".yellow + this.options.overrideCategorization );
				this.dependencies.bower = this.overrideCategorization( this.dependencies.bower, this.options.overrideCategorization );
			}

			if( this.options.unknowns ){
				this.logUnknownDependencies( this.dependencies.bower );
			}

			if( this.options.warnings ){
				this.logWarningDependencies( this.dependencies.bower );
			}

			this.log( "Bower dependency scan complete. ".yellow + ("" + this.dependencies.bower.length + " found").white );

			// if( !self.options.nosave ){
			// 	this.log( "Writing bower licenses file".yellow );
			// 	return self.licenseScanner.writeDependencyCSV( 'bower_license.csv', self.dependencies.bower );
			// }

		}

		overrideCategorization( dependencies, toCategorization ){
			return _.map( dependencies, function( dependency ){
				dependency.isProduction = (toCategorization === 'prod' );
				return dependency;
			} );
		};

		logUnknownDependencies( dependencies ){
			let self = this;
			_.each( dependencies, function( dependency ){
				if( dependency.licenses === 'UNKNOWN' ){
					self.log( "Unknown license: ".red + dependency.name.white + ", " + dependency.repo );
				}
			} )
		};

		logWarningDependencies( dependencies ){
			const self = this;
			const warningLicenses = _.get( self.options, "config.warnOnLicenses" );
			if( _.size( warningLicenses ) === 0 ) return;

			function checkForWarning( licenses ){

				let raiseWarning = false;

				_.each( licenses, license =>{
					_.each( warningLicenses, ( warningLicenseNode ) =>{
						if( _.isString( warningLicenseNode && warningLicenseNode === license ) ){
							raiseWarning = true;
							return false;
						}else if( _.isObject( warningLicenseNode ) && warningLicenseNode.pattern && new RegExp( warningLicenseNode.pattern ).exec( license ) ){
							raiseWarning = true;
							return false;
						}
					} );
					if( raiseWarning ) return false;
				} );

				return raiseWarning;
			}

			_.each( dependencies, function( dependency ){
				if( dependency.licenses ){
					let licenses = dependency.licenses;
					if( !_.isArray( licenses ) ) licenses = [licenses];

					if( checkForWarning( licenses ) ){
						let warningLabel = (dependency.isProduction ) ? "Warning (Production): " : "Warning (Dev): ";
						self.log( warningLabel.red + dependency.name.white + ", " + dependency.repo + " uses licenses: " + licenses.join( ',' ) );
					}
				}
			} )
		}
	}

	module.exports = DirectoryNode;
})();
