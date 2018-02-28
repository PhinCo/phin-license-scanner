( function(){

	const scanningUtils = require('./scanning-utils');
	const _ = require('lodash');
	const path = require('path');
	const git = require('../lib/git');
	require('colors');

	class LicenseScanner {
		constructor( directoryPath, options = {}, licenseConfig ){
			this.directoryPath = path.resolve( directoryPath );
			this.options = options;
			this.licenseConfig = licenseConfig;
			this.dependencies = {};
		}

		static async scanDirectory( directory, options, licenseConfig, workingDirectory ){
			if( !workingDirectory ) workingDirectory = process.cwd();
			else workingDirectory = path.resolve( workingDirectory );

			process.chdir( workingDirectory );
			const licenseScanner = new LicenseScanner( directory, options, licenseConfig );
			await licenseScanner.scan();
			process.chdir( workingDirectory );
			return licenseScanner.dependencies;
		}

		static async scanDirectories( directories, directoryOptions, licenseConfig, workingDirectory ){
			const dependencies = {};

			for( let i = 0; i < directories.length ; i ++ ){
				const directory = directories[i];
				const options = directoryOptions[directory];
				dependencies[directory] = await LicenseScanner.scanDirectory( directory, options, licenseConfig, workingDirectory );
			}

			return dependencies;
		}

		log( message ){
			console.log( this.directoryPath.white + ": " + message );
		}

		async isRepoStatusOK(){
			this.log( "Inspecting Repo".yellow );
			const info = await git.getInfo( this.directoryPath );
			if( !info ) return false;

			if( info.isClean ){
				this.log( "Repo is clean at commit hash ".green + info.hash.substring(0,8).white );
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

		async scan(){
			try{
				if( await this.isRepoStatusOK() ){
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

			try{
				await this.updateNodeDependencies();
			}catch( error ){
				console.error( error );
				this.log( "node update dependencies failed".red );
				this.log( "continuing anyway".red );
			}

			this.log( "Scanning for node dependencies and licenses".yellow );
			this.dependencies.node = await scanningUtils.scanForNodeDependencies( this.directoryPath, this.licenseConfig );
			if( this.options.overrideCategorization ){
				this.log( "Overriding dependency categorization as ".yellow + this.options.overrideCategorization );
				this.dependencies.node = this.overrideCategorization( this.dependencies.node, this.options.overrideCategorization );
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
				return;
			}

			this.log( "Updating bower dependencies".yellow );

			try{
				await this.updateBowerDependencies();
			}catch( error ){
				console.error( error );
				this.log( "bower update dependencies failed".red );
				this.log( "continuing anyway".red );
			}


			this.log( "Scanning for bower dependencies and licenses".yellow );
			this.dependencies.bower = await scanningUtils.scanForBowerDependencies( this.directoryPath, this.licenseConfig );

			if( this.options.overrideCategorization ){
				this.log( "Overriding dependency categorization as ".yellow + this.options.overrideCategorization );
				this.dependencies.bower = this.overrideCategorization( this.dependencies.bower, this.options.overrideCategorization );
			}

			this.log( "Bower dependency scan complete. ".yellow + ("" + this.dependencies.bower.length + " found").white );

		}

		overrideCategorization( dependencies, toCategorization ){
			return _.map( dependencies, function( dependency ){
				dependency.isProduction = (toCategorization === 'prod' );
				return dependency;
			} );
		}

		/*** UTILITY API ***/

		static filterDependenciesWithUnknownLicenses( dependenciesList ){
			return scanningUtils.filterDependenciesWithUnknownLicenses( dependenciesList );
		}

		static filterDependenciesWithLicenseWarnings( dependenciesList, licenseConfig ){
			return scanningUtils.filterDependeniesWithLicenseWarnings( dependenciesList, licenseConfig );
		}

		static sortedMultiDirectoryDependencies( dependenciesByDirectory ){

			function moduleKey( dependency ){
				return dependency.name.split('@')[0];
			}

			const groupedMap = {
				node: {},
				bower: {}
			};

			_.each( dependenciesByDirectory, (dependencies, directory ) => {
				_.each( dependencies.node, nodeDependency => {
					const key = moduleKey( nodeDependency );
					const record = _.extend( nodeDependency, {
						type: "node",
						module: key,
						directory: directory
					});
					if( groupedMap.node[key] === void 0 ) groupedMap.node[key] = [];
					groupedMap.node[key].push( record );
				});
				_.each( dependencies.bower, bowerDependency => {
					const key = moduleKey( bowerDependency );
					const record = _.extend( bowerDependency, {
						type: "bower",
						module: key,
						directory: directory
					});
					if( groupedMap.bower[key] === void 0 ) groupedMap.bower[key] = [];
					groupedMap.bower[key].push( record );
				});
			});

			let list = [];

			_.each( groupedMap.node, ( dependencies, module ) => {
				list = list.concat( dependencies );
			});
			_.each( groupedMap.bower, ( dependencies, module ) => {
				list = list.concat( dependencies );
			});

			return _.sortBy( list, ['type','module','name','directory'] );
		}

	}

	module.exports = LicenseScanner;
})();
