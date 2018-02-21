( function(){

	const DirectoryScanRunner = require('./DirectoryRunner');
	const _ = require('lodash');
	const path = require('path');
	const fs = require('fs');
	const Promise = require('bluebird');

	class DirectoryNode {
		constructor( directoryPath, options ){
			this.directoryPath = directoryPath;
			this.options = options;
			this.dependencies = {};
			this.statusMessages = [];
		}
	}

	function Runner( runner, options ){
		this.runner = runner;
		this.masterOptions = _.extend( options, runner.options );
		this.startDirectory = _.get( options, "startDirectory", process.cwd());

		this.dependencies = {};
	}


	Runner.buildRunnerWithDirectoriesAndOptions = function( directories, options ){
		let runner = {
			options: options,
			directories: {}
		};

		_.each( directories, dirPath => {
			runner.directories[ dirPath ] = {};
		});

		return runner;
	};


	Runner.prototype.run = async function(){
		const self = this;

		await Promise.all( _.map( this.runner.directories, (dirOptions, dirPath) =>
				self.runDirectoryNode( {
					path: path.resolve( dirPath ),
					options: dirOptions
				})
			)
		);

		if( self.masterOptions.output ){
			const dependenciesToReport = self.processDependenciesForReport( self.dependencies );
			self.writeReportFile( dependenciesToReport, self.masterOptions.output );
		}

	};

	Runner.prototype.runDirectoryNode = async function( directoryNode ){
		const self = this;
		const options = _.extend( directoryNode.options, self.masterOptions );

		self.dependencies[ directoryNode.path ] = await new DirectoryScanRunner( directoryNode.path, options ).perform();
		process.chdir( self.startDirectory );
	};



	Runner.prototype.processDependenciesForReport = function( dependencies, productionOnly ){
		let aggregate = [];
		_.each( dependencies, depNode =>{
			_.each( depNode, depArray =>{
				aggregate = aggregate.concat( depArray );
			} );
		} );

		if( productionOnly ){
			aggregate = _.filter( aggregate, { isProduction: true } );
		}

		const listWithCleanNames = _.map( aggregate, dep => {
			const cleanName = dep.name.split( '@' )[0];
			return {
				name: cleanName,
				publisher: dep.publisher,
				licenses: dep.licenses,
				email: dep.email,
				isProduction: dep.isProduction
			};
		});

		// BUG: should merge such that same entry combines isProduction in an OR fashion
		return _.sortBy( _.uniqWith( listWithCleanNames, (a,b) => a.name === b.name && a.isProduction === b.isProduction ) );
	};


	Runner.prototype.writeReportFile = function( dependencies, options ){
		if( !options.format || options.format.toLowerCase() === "json" ){

			const outputJSON = {
				dependencies: dependencies
			};

			const filepath = path.resolve( options.path );

			console.log(`\nWriting ${dependencies.length} dependencies to ${filepath}`.yellow );

			const error = fs.writeFileSync( options.path, JSON.stringify( outputJSON, null, 2 ), { encoding: 'utf8' } );
			if( error ) throw new Error( `Failed to write to ${filepath}` );

		}else{
			console.error( `Unsupported file format for report output: ${options.format}`);
		}
	};

	module.exports = Runner;

})();
