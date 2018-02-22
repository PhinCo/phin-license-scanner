( function(){
	'use strict';

	const { spawn } = require('child_process');
	const _ = require("lodash");
	const util = require('util');

	exports.runCommand = async function( command, args, options ){

		const defaults = {
			streamStdOut: false,
			streamStdErr: false
		};

		if( !_.isArray( args )) args = args.split(' ');

		options = _.extend( {
			streamStdOut: false,
			streamStdErr: false
		}, options );

		let runningCommand = false;
		try{
			runningCommand = spawn( command, args, options );
		}catch( error ){
			throw error( "Exec-Wrapper failed to run command: " + command, error.code );
		}

		const stdout = [];
		const stderr = [];

		function _buildResult( code, signal, error ){
			return {
				code,
				signal,
				error,
				stdout: (stdout) ? stdout.join("\n") : "",
				stderr: (stderr) ? stderr.join("\n") : "",
				command: command + (_.isArray( args ) ) ? args.join(' ') : ""
			}
		}

		runningCommand.stdout.on( 'data', function( data ){
			const text = data.toString('utf8');
			stdout.push( text );
			if( options.streamStdOut ) console.log( text.yellow );
		});

		runningCommand.stderr.on( 'data',  function( data ){
			const text = data.toString('utf8');
			stderr.push( text );
			if( options.streamStdErr ) console.log( text.red );
		});

		runningCommand.on( 'exit',  function( code, signal ){
			Promise.resolve( _buildResult( code, signal ) );
		});

		runningCommand.on( 'error',  function( error ){
			Promise.resolve( _buildResult( -1, -1, error ));
		});
	};

})();
