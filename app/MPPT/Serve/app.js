
var SerialPort = require("serialport").SerialPort;
var http = require('http');

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
		serialPort.drain( function() {
	
			for( var i in cfgChannels.calibration ) {
			
				sendStatus( i, cfgDevices[ i ] );
				updateConfig( i, cfgDevices[ i ] );
				serialPort.write("7," + i + "," + cfgChannels.calibration[ i ].DACSlope + "," + cfgChannels.calibration[ i ].DACOffset + ";");
				serialPort.write("10," + i + "," + cfgChannels.calibration[ i ].ADCSlopePositive + "," + cfgChannels.calibration[ i ].ADCOffsetPositive + "," + cfgChannels.calibration[ i ].ADCSlopeNegative + "," + cfgChannels.calibration[ i ].ADCOffsetNegative + ";");
			}
			
			

		});


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
				setTimeout( reconnect, 5000 );
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


		var data2 = data.replace(';', '').split(',');

		var deviceId = parseFloat( data2[ 1 ] );
		var current = parseFloat( data2[ 2 ] ) / 1000000;
		var voltage = parseFloat( data2[ 3 ] ) / 1000000;
		var power = parseFloat( data2[ 4 ] ) / 1000000;
		
		data = "";
		

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
		
	}	
});

/*
setInterval( function() {

	var deviceId = 1;
		powers[ deviceId ] = powers[ deviceId ] || [];
		voltages[ deviceId ] = voltages[ deviceId ] || [];
		currents[ deviceId ] = currents[ deviceId ] || [];


	powers[ 1 ].push( [ Date.now(), Math.random() ] );
	voltages[ 1 ].push( [ Date.now(), Math.random() ] );
	currents[ 1 ].push( [ Date.now(), Math.random() ] );
}, 100 );*/

setInterval( function() {

	for( var i in cfgDevices ) {

		var data;

		var filename = getFilename( cfgDevices[ i ] );
		
		if( cfgDevices[ i ].status == "running" ) {

			try {
				fs.statSync( filename );
			} catch ( e ) {
				fs.appendFileSync( filename, "Time\tVoltage\tCurrent\tPower" );
			}
			
			data = "";

			if( powers[ i ] ) {
				for( var j = 0, l = powers[ i ].length; j < l; j ++ ) {
					data += "\r\n" + voltages[ i ][ j ][ 0 ] + "\t" + voltages[ i ][ j ][ 1 ] + "\t" + currents[ i ][ j ][ 1 ] + "\t" + powers[ i ][ j ][ 1 ];
				}
			}

			fs.appendFileSync( filename, data );		

			powers[ i ] = [];
			currents[ i ] = [];
			voltages[ i ] = [];

			latestDataSent[ i ] = 0;
		}
	}
}, 100000 );


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
	deleteConfig( req.params[ '0' ] );

	powers[ req.params[ '0' ] ] = [];
	currents[ req.params[ '0' ] ] = [];
	voltages[ req.params[ '0' ] ] = [];
	res.send("ok");
});

app.get(/\/updateChannel\/([0-9]+)/, function( req, res ) {
	var config = req.query;
	updateConfig( req.params[ '0' ], config );
	res.send("ok");
});

function deleteConfig( deviceId ) {
	delete cfgDevices[ deviceId ];
}

function updateConfig( deviceId, config ) {	

	if( ! config ) {
		return;
	}

	cfgDevices[ deviceId ] = cfgDevices[ deviceId ] || {};

	if( config.status != cfgDevices[ deviceId ].status || config.samplerate != cfgDevices[ deviceId ].samplerate ) {
		sendStatus( deviceId, config );
	}

	cfgDevices[ deviceId ] = config;
	fs.writeFileSync( "config.json", JSON.stringify( cfgDevices ) );

	
}

function sendStatus( deviceId, config ) {

	if( ! config ) {
		return;
	}

	
	switch( config.status ) {

		case 'running':

			arduino.send("9," + deviceId + ",1;");
			if( config.samplerate ) {
				arduino.send( "6," + deviceId + "," + config.samplerate + ";" );
			}
		break;

		case 'paused':
			arduino.send( "9," + deviceId + ",0;");
			arduino.send( "6," + deviceId + ",-2;" );
		break;

		case 'stopped':
			arduino.send( "9," + deviceId + ",0;");
			arduino.send( "6," + deviceId + ",-3;" );
		break;
	}

}


var connections = [];

var WebSocketServer = require('ws').Server, 
	wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
  
  ws.on('message', function incoming(message) {

    	message = JSON.parse( message );

    	if( message.command == "getAll" ) {

			var obj = [];		
				
    		for( var i in cfgDevices ) {

				if( cfgDevices[ i ].status == "running" ) {

					try {
						var file = fs.readFileSync( getFilename( cfgDevices[ i ] ) ).toString('ascii').split('\r\n'),
							line,
							data = { powers: [], currents: [], voltages: [] };

						for( var j = 1; j < file.length; j ++ ) {
							line = file[ j ].split("\t");

							data.powers.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 3 ] )  ]  );
							data.currents.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 2 ] )  ]  );
							data.voltages.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 1 ] ) ]  );
						}				

						obj.push( {
							deviceId: i,
							data: data
						});

					} catch ( e ) { } 
				
					
				}

			}

			ws.send( 
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

			ws.send( 
				JSON.stringify( obj )
			);
		}


  });

  
});
