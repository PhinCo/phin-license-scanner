( function(){
	'use strict';

	const { spawn } = require('child_process');
	const _ = require("lodash");

	exports.runCommand = async function( command, args, options ){
		const stdout = [];
		const stderr = [];

		options = _.extend( {
			streamStdOut: false,
			streamStdErr: false
		}, options );


		return new Promise( resolve =>{
			if( !_.isArray( args ) ) args = args.split( ' ' );

			const runningCommand = spawn( command, args, options );

			function _buildResult( code, signal, error ){
				return {
					code,
					signal,
					error,
					stdout: (stdout) ? stdout.join( "\n" ) : "",
					stderr: (stderr) ? stderr.join( "\n" ) : "",
					command: command + ((_.isArray( args ) ) ? args.join( ' ' ) : "")
				}
			}

			runningCommand.stdout.on( 'data', function( data ){
				const text = data.toString( 'utf8' );
				stdout.push( text );
				if( options.streamStdOut ) console.log( text.yellow );
			} );

			runningCommand.stderr.on( 'data', function( data ){
				const text = data.toString( 'utf8' );
				stderr.push( text );
				if( options.streamStdErr ) console.log( text.red );
			});

			runningCommand.on( 'exit', function( code, signal ){
				const result = _buildResult( code, signal );
				resolve( result );
			});

			runningCommand.on( 'error', function( error ){
				resolve( _buildResult( -1, -1, error ) );
			});
		});
	};

})();
