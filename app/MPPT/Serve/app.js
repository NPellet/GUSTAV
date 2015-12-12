
var SerialPort = require("serialport").SerialPort;
var http = require('http');
var sockjs = require('sockjs');
var express = require('express');
var app = express();
var fs = require('fs');

var serialPort = new SerialPort("/dev/cu.usbmodem1411", {
  baudrate: 115200,
  dataBits: 8, 
  flowControl: true,
  stopBits: 1,
}, false );

serialPort.on("open", function() {	
	setTimeout( function() {
		//serialPort.write( "5,5,2048;" );		
		serialPort.drain();
		for( var i in cfgChannels.calibration ) {

			
			serialPort.write("7," + i + "," + cfgChannels.calibration[ i ].DACSlope + "," + cfgChannels.calibration[ i ].DACOffset + "," + cfgChannels.calibration[ i ].ADCSlope + "," + cfgChannels.calibration[ i ].ADCOffset + ";" );
		}
		sendStatus( i, cfgDevices[ i ] );

		updateConfig( i, cfgDevices[ i ] );

	}, 1000 );
});

var arduino = {
	send: function( message ) {

		if( ! serialPort.isOpen() ) {
			serialPort.open( function( err ) {
				serialPort.write( message );		
			} );
		} else {
			console.log( message );
				serialPort.write( message );		
		}
	}
}

var powers = [];
var voltages = [];
var currents = [];

var data = "";
var latestDataSent = [];

serialPort.on("error", function( error ) { 
	console.log('err', error );
	setTimeout( reconnect, 1000 );
} );

serialPort.on("close", function() {
	console.log('closed');
	setTimeout( reconnect, 1000 );
});

function reconnect( callback ) {

	if( ! serialPort.isOpen() ) {
		console.log('retry');
		serialPort.open( function( err ) {


			if( err ) {
				setTimeout( reconnect, 1000 );
				return false;
			}

			if( callback ) {
				callback();
			}
		});
	}
	//console.log( serialPort );
}

reconnect();

var counter = 0;
serialPort.on("data", function( d ) {

	data += d.toString('ascii');

	if( data.indexOf(";") > -1 ) {

		data = data.replace(';', '').split(',');
		
		var deviceId = parseFloat( data[ 1 ] );
		var current = parseFloat( data[ 2 ] ) / 1000000;
		var voltage = parseFloat( data[ 3 ] ) / 1000000;
		var power = parseFloat( data[ 4 ] ) / 1000000;
		counter++;

		if( counter < 5 ) {
			return;
		}

		if( Math.abs( current ) > 19e-3 ) {
			return;
		}

		powers[ deviceId ] = powers[ deviceId ] || [];
		voltages[ deviceId ] = voltages[ deviceId ] || [];
		currents[ deviceId ] = currents[ deviceId ] || [];

		if( powers[ deviceId ] && voltages[ deviceId ] && currents[ deviceId ] ) {

			powers[ deviceId ].push( [ Date.now(), power ] );
			voltages[ deviceId ].push( [ Date.now(), voltage ] );
			currents[ deviceId ].push( [ Date.now(), current ] );
		
		}
		data = "";
	}	
});


setInterval( function() {

	for( var i in cfgDevices ) {

		var data;

		var filename = getFilename( cfgDevices[ i ] );
		
		if( cfgDevices[ i ].status == "running" ) {

			try {
				fs.statSync( filename );
			} catch ( e ) {
				fs.appendFileSync( filename, "Voltage\tCurrent\tPower" );
			}
			
			data = "";

			if( powers[ i ] ) {
				for( var j = 0, l = powers[ i ].length; j < l; j ++ ) {
					data += voltages[ i ][ j ][ 0 ] + "\t" + voltages[ i ][ j ][ 1 ] + "\t" + currents[ i ][ j ][ 1 ] + "\t" + powers[ i ][ j ][ 1 ] + "\r\n";
				}
			}

			fs.appendFileSync( filename, data );		

			powers[ i ] = [];
			currents[ i ] = [];
			voltages[ i ] = [];

			latestDataSent[ i ] = 0;
		}
	}
}, 10000 );


function getFilename( device ) {
	return "data/" + device.name + "_" + device.starttime;
}




app.use(express.static('public'));
var server = app.listen(3000);

app.get('/', function (req, res) {
	return;
});

var cfgDevices, cfgChannels;
cfgChannels = JSON.parse( fs.readFileSync( 'channels.json' ) );
cfgDevices = JSON.parse( fs.readFileSync( 'config.json' ) );

app.get('/getCurrentStatus', function( req, res ) {
	res.type("application/json");

	res.send( { channels: cfgChannels, devices: cfgDevices } );
});

app.get(/\/startChannel\/([0-9]+)/, function( req, res ) {
	var config = req.query;
	config.status = "running";
	config.starttime = Date.now();
	updateConfig( req.params[ '0' ], config );
	res.send("ok");
});

app.get(/\/pauseChannel\/([0-9]+)/, function( req, res ) {
	var config = req.query;
	config.status = "paused";
	updateConfig( req.params[ '0' ], config );
	res.send("ok");
});

app.get(/\/stopChannel\/([0-9]+)/, function( req, res ) {
	var config = req.query;
	config.status = "stopped";
	updateConfig( req.params[ '0' ], config );

	powers = [];
	currents = [];
	voltages = [];
	res.send("ok");
});

app.get(/\/updateChannel\/([0-9]+)/, function( req, res ) {
	var config = req.query;
	updateConfig( req.params[ '0' ], config );
	res.send("ok");
});

function updateConfig( deviceId, config ) {	
		
	cfgDevices[ deviceId ] = cfgDevices[ deviceId ] || {};

	if( config.status != cfgDevices[ deviceId ].status || config.samplerate != cfgDevices[ deviceId ].samplerate ) {
		sendStatus( deviceId, config );
	}

	cfgDevices[ deviceId ] = config;
	fs.writeFileSync( "config.json", JSON.stringify( cfgDevices ) );

	
}

function sendStatus( deviceId, config ) {

	switch( config.status ) {

		case 'running':
console.log( deviceId, config );
			if( config.samplerate ) {
				arduino.send( "6," + deviceId + "," + config.samplerate + ";" );
			}
		break;

		case 'paused':
			arduino.send( "6," + deviceId + ",-2;" );
		break;

		case 'stopped':
			arduino.send( "6," + deviceId + ",-3;" );
		break;
	}

}


var connections = [];
var echo = sockjs.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js' });
echo.on('connection', function(conn) {
    
    conn.on('close', function() {});

    conn.on('data', function(message) {

    	message = JSON.parse( message );

    	if( message.command == "getAll" ) {

			var obj = [];		
				
    		for( var i in cfgDevices ) {

				if( cfgDevices[ i ].status == "running" ) {

					if( fs.exists( getFilename( cfgDevices[ i ] ) ) ) {

						var file = fs.readFileSync( getFilename( cfgDevices[ i ] ) ).toString('ascii').split('\r\n'),
							line,
							data = { powers: [], currents: [], voltages: [] };

						for( var j = 1; j < file.length; j ++ ) {
							line = file[ j ].split("\t");
							data.powers.push( [ parseInt( line[ 0 ] ), parseInt( line[ 3 ] ) ]  );
							data.currents.push( [ parseInt( line[ 0 ] ), parseInt( line[ 2 ] ) ]  );
							data.voltages.push( [ parseInt( line[ 0 ] ), parseInt( line[ 1 ] ) ]  );
						}
console.log( i );
console.log( data );
						obj.push( {
							deviceId: i,
							data: data
						});

					}
					
				}

			}

			conn.write( 
				JSON.stringify( { data: obj, latest: {} } )
			);


    	} else if( message.command == "getLatest" ) {
			
			var obj = { data: [], latest: message.latest };

			for( var i in cfgDevices ) {

				if( cfgDevices[ i ].status == "running" && powers[ i ] && powers[ i ].length > 0 ) {

					message.latest[ i ] = message.latest[ i ] || 0;

					obj.data.push( {
						deviceId: i,
						data: { 
							powers: powers[ i ].slice( message.latest[ i ] || 0 ), 
							voltages: voltages[ i ].slice( message.latest[ i ] || 0 ), 
							currents: currents[ i ].slice( message.latest[ i ] || 0 ) 
						} 
					} );

					message.latest[ i ] = powers[ i ].length;
				}
			}

			conn.write( 
				JSON.stringify( obj )
			);
		}
    });
});

var serverSocket = http.createServer();
serverSocket.listen(9999, '0.0.0.0');
echo.installHandlers(serverSocket, {prefix:'/socket'});

