( function(){

	const _ = require('lodash');
	const path = require('path');
	const fs = require('fs');

	function parsePrivateRegistryDependency( string ){
		const privateRepoRegex = /^@(.*)\/(.*)@(.*)$/;
		const matches = privateRepoRegex.exec( string );
		if( matches.length !== 4 ) throw new Error( `Dependency failed to parse: ${string}`);
		return {
			dependency: matches[0],
			registry: `@${matches[1]}`,
			name: matches[2],
			longName: `@${matches[1]}/${matches[2]}`,
			version: matches[3]
		};
	}

	function parseGlobalRegistryDependency( string ){
		const globalRepoRegex = /^(.*)@(.*)$/;
		const matches = globalRepoRegex.exec( string );
		if( matches.length !== 3 ) throw new Error( `Dependency failed to parse: ${string}`);
		return {
			dependency: matches[0],
			name: matches[1],
			longName: matches[1],
			version: matches[2],
		};
	}

	exports.parseDependency = function( string ){
		if( !string ) throw new Error( "dependency required");
		if( !_.isString( string )) throw new Error("String expected");

		let output = {};

		if( string[0] === '@' ){
			output = parsePrivateRegistryDependency( string );
		}else{
			output = parseGlobalRegistryDependency( string );
		}

		return output;
	};

	exports.loadJSON = function( filePath ){
		filePath = path.resolve( filePath );

		let fileData = false;
		let jsonData = false;

		try{
			fileData = fs.readFileSync( filePath, {encoding: 'utf8'} );
		}catch( error ){
			throw new Error( `Failed to read json file: ${filePath}, ${error.message}`);
		}

		try{
			jsonData = JSON.parse( fileData );
		}catch( error ){
			throw new Error( `Failed to parse json file: ${filePath}, ${error.message}`);
		}

		return jsonData;
	}
})();
