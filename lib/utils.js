( function(){

	const _ = require('lodash');

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


})();
