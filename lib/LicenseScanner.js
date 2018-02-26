( function(){

	const scanningUtils = require('./scanning-utils');
	const _ = require('lodash');
	require('colors');

	class LicenseScanner {
		constructor( directoryPath, options, licenseConfig ){
			this.directoryPath = directoryPath;
			this.options = options;
			this.licenseConfig = licenseConfig;
			this.dependencies = {};
		}

		log( message ){
			console.log( this.directoryPath.white + ": " + message );
		}

		allDependencies(){
			let output = [];
			if( this.dependencies.bower ) output = output.concat( this.dependencies.bower );
			if( this.dependencies.node ) output = output.concat( this.dependencies.node );
			return output;
		}

		async isRepoStatusOK(){
			this.log( "Inspecting Repo".yellow );
			const info = await scanningUtils.getRepoInfo( this.directoryPath );
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
			return await scanningUtils.installNodeDependencies( this.directoryPath );
		}

		async scanNodeDependencies(){
			this.dependencies.node = [];

			if( !scanningUtils.isNodeProject( this.directoryPath) ){
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
			this.dependencies.node = await scanningUtils.scanForNodeDependencies( this.directoryPath, this.licenseConfig );
			if( this.options.overrideCategorization ){
				this.log( "Overriding dependency categorization as ".yellow + this.options.overrideCategorization );
				this.dependencies.node = this.overrideCategorization( this.dependencies.node, this.options.overrideCategorization );
			}

			// TODO: Move to arrays and let CLI output
			if( this.options.unknowns ){
				this.logUnknownDependencies( this.dependencies.node );
			}

			if( this.options.warnings ){
				this.logWarningDependencies( this.dependencies.node );
			}

			this.log( "Node dependency scan complete. ".yellow + ("" + this.dependencies.node.length + " found").white );
		}

		async updateBowerDependencies(){
			if( this.options.skipUpdate ) return;
			return await scanningUtils.installBowerDependencies( this.directoryPath );
		}

		async scanBowerDependencies(){
			this.dependencies.bower = [];

			if( !scanningUtils.isBowerProject( this.directoryPath )){
				this.log( "Not a bower project".yellow );
				return;
			}

			if( this.options.skipBower ){
				this.log( "Skipping bower scanning".yellow );
			}

			this.log( "Updating bower dependencies".yellow );

			await this.updateBowerDependencies();
			this.log( "Scanning for bower dependencies and licenses".yellow );
			this.dependencies.bower = await scanningUtils.scanForBowerDependencies( this.directoryPath, this.licenseConfig );

			if( this.options.overrideCategorization ){
				this.log( "Overriding dependency categorization as ".yellow + this.options.overrideCategorization );
				this.dependencies.bower = this.overrideCategorization( this.dependencies.bower, this.options.overrideCategorization );
			}

			// TODO: Move to arrays and let CLI output
			if( this.options.unknowns ){
				this.logUnknownDependencies( this.dependencies.bower );
			}

			if( this.options.warnings ){
				this.logWarningDependencies( this.dependencies.bower );
			}

			this.log( "Bower dependency scan complete. ".yellow + ("" + this.dependencies.bower.length + " found").white );

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

	module.exports = LicenseScanner;
})();
