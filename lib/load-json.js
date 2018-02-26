( function(){

	const fs = require('fs');
	const path = require('path');

	module.exports = function( filePath ){
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
