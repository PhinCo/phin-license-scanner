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

	DirectoryScanRunner.scanDirectories = function( directories, options ){
		const scanFromDirectory = process.cwd();
		var dependencies = {};

		return Promise.mapSeries( directories, function( directoryPath ){
			var directoryScanRunner = new DirectoryScanRunner( directoryPath, options );

			return directoryScanRunner.perform()
			.then( () => {
				dependencies[ directoryPath ] = directoryScanRunner.dependencies;
			})
			.catch( error => {
				console.error(`Error while scanning ${directoryPath}: ${error.message}`);
			})
			.then( () => {
				process.chdir( scanFromDirectory );
			})
		})
		.then( () => {
			if( options.output ){
				outputAggregateDependencies( dependencies, options.output );
			}
		});

	};

	DirectoryScanRunner.run = function( runner, masterOptions ){
		const scanFromDirectory = process.cwd();

		var dependencies = {};
		masterOptions = _.extend( masterOptions, runner.options );

		var directories = _.map( runner.directories, function( options, dirpath ){
			return { path: path.resolve( dirpath ), options: options };
		});

		return Promise.mapSeries( directories, function( directoryNode ){
			var options = _.extend( masterOptions, directoryNode.options );

			var directoryScanRunner = new DirectoryScanRunner( directoryNode.path, options );

			return directoryScanRunner.perform()
			.then( () => {
				dependencies[ directoryNode.path ] = directoryScanRunner.dependencies;
			})
			.catch( error => {
				console.error(`Error while scanning ${directoryNode.path}: ${error.message}`);
			})
			.then( () => {
				process.chdir( scanFromDirectory );
			})
		})
		.then( () => {
			console.log('CWD3: ' + process.cwd());
			if( masterOptions.output ){
				outputAggregateDependencies( dependencies, masterOptions.output );
			}
		});
	};

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
			.then( function( dependencies ){
				self.dependencies.node = dependencies;
				if( self.options.overideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + self.options.overideCategorization );
					self.dependencies.node = self.overrideCategorization( self.dependencies.node, self.options.overideCategorization );
				}
			})
			.then( function(){
				if( self.options.unknowns ){
					self.logUknowns( self.dependencies.node );
				}
			})
			.then( function(){
				console.log( "Node dependency scan complete. ".yellow + ("" + self.dependencies.node.length + " found").white );
				console.log( "Writing node licenses file".yellow );
				return self.scanner.writeDependencyCSV( 'node_license.csv', self.dependencies.node );
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
				if( self.options.overideCategorization ){
					console.log( "Overriding dependency categorization as ".yellow + self.options.overideCategorization );
					self.dependencies.bower = self.overrideCategorization( self.dependencies.bower, self.options.overideCategorization );
				}
			})
			.then( function(){
				if( self.options.unknowns ){
					self.logUknowns( self.dependencies.bower );
				}
			})
			.then( function(){
				console.log( "Bower dependency scan complete. ".yellow + ("" + self.dependencies.bower.length + " found").white );
				console.log( "Writing bower licenses file".yellow );
				return self.scanner.writeDependencyCSV( 'bower_license.csv', self.dependencies.bower );
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

	function outputAggregateDependencies( dependencies, options ){
		var aggregate = [];
		_.each( dependencies, depNode => {
			_.each( depNode, depArray => {
				aggregate = aggregate.concat( depArray );
			});
		});

		var productionOnly = _.filter( aggregate, { isProduction: true });
		var clean = _.map( productionOnly, dep => {
			var cleanName = dep.name.split('@')[0];
			return { name: cleanName, publisher: dep.publisher, licenses: dep.licenses, email: dep.email };
		});
		var data = _.uniqBy( clean, "name" );

		if( !options.format || options.format.toLowerCase() === "json" ){
			var output = { dependencies: data };
			var filepath = path.resolve( options.path );
			console.log(`Writing ${data.length} dependencies to ${filepath}`.yellow );
			var error = fs.writeFileSync( options.path, JSON.stringify( output, null, 2 ), { encoding: 'utf8' } );
			if( error ) throw new Error( `Failed to write to ${filepath}` );
		}else{
			console.error( `Unsupported file format for output: ${options.format}`);
		}
	}

	module.exports = DirectoryScanRunner;
})();