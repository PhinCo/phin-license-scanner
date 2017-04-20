( function(){

	var DirectoryScanRunner = require('./DirectoryScanRunner');
	var _ = require('lodash');
	var path = require('path');
	var fs = require('fs');
	var Promise = require('bluebird');

	function ScanRunner( runner, options ){
		this.runner = runner;
		this.masterOptions = _.extend( options, runner.options );
		this.startDirectory = _.get( options, "startDirectory", process.cwd());

		this.directoryNodes = _.map( this.runner.directories, function( dirOptions, dirpath ){
			return {
				path: path.resolve( dirpath ),
				options: dirOptions
			};
		});

		this.dependencies = {};
		this.dependenciesToReport = [];
	}


	ScanRunner.buildRunnerWithDirectoriesAndOptions = function( directories, options ){
		let runner = {
			options: options,
			directories: {}
		};

		_.each( directories, dirPath => {
			runner.directories[ dirPath ] = {};
		});

		return runner;
	};


	ScanRunner.prototype.run = function(){
		var self = this;

		return Promise.mapSeries( this.directoryNodes, function( directoryNode ){

			const options = _.extend( directoryNode.options, self.masterOptions );
			const directoryScanRunner = new DirectoryScanRunner( directoryNode.path, options );

			return directoryScanRunner.perform()
			.then( () => {
				self.dependencies[ directoryNode.path ] = directoryScanRunner.dependencies;
			})
			.catch( error => {
				console.error(`Error while scanning ${directoryNode.path}: ${error.message}`);
			})
			.then( () => {
				process.chdir( self.startDirectory );
			})
		})
		.then( () => {
			self.dependenciesToReport = self.processDependenciesForReport( self.dependencies );
		})
		.then( () => {
			if( self.masterOptions.output && !self.masterOptions.nosave ){
				self.writeReportFile( self.dependenciesToReport, self.masterOptions.output );
			}
		});
	};

	ScanRunner.prototype.processDependenciesForReport = function( dependencies ){
		var aggregate = [];
		_.each( dependencies, depNode =>{
			_.each( depNode, depArray =>{
				aggregate = aggregate.concat( depArray );
			} );
		} );

		var productionOnly = _.filter( aggregate, { isProduction: true } );
		var clean = _.map( productionOnly, dep => {
			var cleanName = dep.name.split( '@' )[0];
			return {
				name: cleanName,
				publisher: dep.publisher,
				licenses: dep.licenses,
				email: dep.email
			};
		});

		return _.sortBy( _.uniqBy( clean, "name" ), "name" );
	};


	ScanRunner.prototype.writeReportFile = function( dependencies, options ){
		if( !options.format || options.format.toLowerCase() === "json" ){

			const outputJSON = {
				dependencies: data
			};

			var filepath = path.resolve( options.path );

			console.log(`\nWriting ${dependencies.length} dependencies to ${filepath}`.yellow );

			var error = fs.writeFileSync( options.path, JSON.stringify( outputJSON, null, 2 ), { encoding: 'utf8' } );
			if( error ) throw new Error( `Failed to write to ${filepath}` );

		}else{
			console.error( `Unsupported file format for report output: ${options.format}`);
		}
	};

	module.exports = ScanRunner;

})();