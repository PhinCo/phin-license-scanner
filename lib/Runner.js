( function(){

	const LicenseScanner = require('./LicenseScanner');
	const _ = require('lodash');
	const path = require('path');
	const fs = require('fs');


	class Runner {
		constructor( runner, options ){
			this.runner = runner;
			this.masterOptions = _.extend( options, runner.options );
			this.startDirectory = _.get( options, "startDirectory", process.cwd() );
			this.directoryNodes = this._buildDirectoryNodes();
		}

		// TODO: Have this return a Runner class, not just a configuration body
		static buildRunnerWithDirectoriesAndOptions( directories, options ){
			let runner = {
				options: options,
				directories: {}
			};

			_.each( directories, dirPath =>{
				runner.directories[dirPath] = {};
			} );

			return runner;
		}

		_buildDirectoryNodes(){
			const nodes = [];
			for( const directory in this.runner.directories ){
				const directoryOptions = this.runner.directories[directory];
				const options = _.extend( directoryOptions, this.masterOptions );

				const directoryPath = path.resolve( this.startDirectory, directory );
				if( fs.existsSync( directoryPath ) ){
					nodes.push( new LicenseScanner( directoryPath, options ) );
				}else{
					console.log( `${directoryPath} not found ` );
				}

			}
			return nodes;
		}

		//---------------------------
		// Run through all directories
		//---------------------------

		async run(){

			for( const directoryNode of this.directoryNodes ){
				process.chdir( this.startDirectory );
				await directoryNode.performScan();
			}
		}

		allDependencies( productionOnly ){
			let aggregate = [];

			this.directoryNodes.forEach( directoryNode => {
				aggregate = aggregate.concat( directoryNode.allDependencies());
			});

			if( productionOnly ){
				aggregate = _.filter( aggregate, { isProduction: true } );
			}

			const listWithCleanNames = _.map( aggregate, dep =>{
				const cleanName = dep.name.split( '@' )[0];
				return {
					name: cleanName,
					publisher: dep.publisher,
					licenses: dep.licenses,
					email: dep.email,
					isProduction: dep.isProduction
				};
			});

			// Sort by name, then production, then dev
			// When uniq'ing this sorted list, production instance of duplication is retained in final output
			const sortedList = _.sortBy( listWithCleanNames, ["name", dep => -(dep.isProduction)] );
			return _.uniqWith( sortedList, ( a, b ) => a.name === b.name );
		}
	}

	module.exports = Runner;

})();
