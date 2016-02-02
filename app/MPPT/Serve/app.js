
var SerialPort = require("serialport").SerialPort;
var http = require('http');

var express = require('express');
var app = express();
var fs = require('fs');
var http = require('http');

var serialPort = new SerialPort("/dev/tty.usbmodem1421", {
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

				serialPort.write("7,0," + i + "," + cfgChannels.calibration[ i ].DACSlope + "," + cfgChannels.calibration[ i ].DACOffset + ";");
				serialPort.write("10,0," + i + "," + cfgChannels.calibration[ i ].ADCSlopePositive + "," + cfgChannels.calibration[ i ].ADCOffsetPositive + "," + cfgChannels.calibration[ i ].ADCSlopeNegative + "," + cfgChannels.calibration[ i ].ADCOffsetNegative + ";");


				console.log( "10,0," + i + "," + cfgChannels.calibration[ i ].ADCSlopePositive + "," + cfgChannels.calibration[ i ].ADCOffsetPositive + "," + cfgChannels.calibration[ i ].ADCSlopeNegative + "," + cfgChannels.calibration[ i ].ADCOffsetNegative + ";" );
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

var times = [];
var powers = [];
var voltages = [];
var currents = [];

var powermin = [];
var voltagemin = [];
var currentmin = [];

var powermax = [];
var voltagemax = [];
var currentmax = [];

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
/*
setInterval( function() {
	serialPort.emit( "data", "5,0," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + "," + Math.random() * 1000000 + ";");
}, 100 );
*/
serialPort.on("data", function( d ) {

	data += d.toString('ascii');

	while( data.indexOf(";") > -1 ) {

		var data2 = data.substr(0, data.indexOf(";") ).replace(';', '');

		if( data2.indexOf('IV') > -1 ) {

			data2 = data2.replace(">", "");
			data2 = data2.split(",");

			var nothing = data2.shift();
			var chanNum = data2.shift();
			var nbPoints = data2.shift();

			fs.writeFileSync("IV_" + chanNum + "_" + Date.now() + ".txt", data2.join("\n") );

		} else {

console.log( data2 );
			data2 = data2.split(',');

			var deviceId = parseFloat( data2[ 1 ] );
			var current = parseFloat( data2[ 2 ] ) / 1000000;
			var voltage = parseFloat( data2[ 3 ] ) / 1000000;
			var power = parseFloat( data2[ 4 ] ) / 1000000;
			
			var _currentmin = parseFloat( data2[ 5 ] ) / 1000000;
			var _voltagemin = parseFloat( data2[ 7 ] ) / 1000000;
			var _powermin = parseFloat( data2[ 9 ] ) / 1000000;
			
			var _currentmax = parseFloat( data2[ 6 ] ) / 1000000;
			var _voltagemax = parseFloat( data2[ 8 ] ) / 1000000;
			var _powermax = parseFloat( data2[ 10 ] ) / 1000000;

			
			/*
			if( Math.abs( current ) > 19e-3 ) {
				return;
			}
	*/
			times[ deviceId ] = times[ deviceId ] || [];
			powers[ deviceId ] = powers[ deviceId ] || [];
			voltages[ deviceId ] = voltages[ deviceId ] || [];
			currents[ deviceId ] = currents[ deviceId ] || [];

			powermin[ deviceId ] = powermin[ deviceId ] || [];
			voltagemin[ deviceId ] = voltagemin[ deviceId ] || [];
			currentmin[ deviceId ] = currentmin[ deviceId ] || [];

			powermax[ deviceId ] = powermax[ deviceId ] || [];
			voltagemax[ deviceId ] = voltagemax[ deviceId ] || [];
			currentmax[ deviceId ] = currentmax[ deviceId ] || [];


			times[ deviceId ].push( Date.now() );
			powers[ deviceId ].push( power );
			voltages[ deviceId ].push( voltage );
			currents[ deviceId ].push( current );

			powermin[ deviceId ].push( _powermin );
			powermax[ deviceId ].push( _powermax );

			voltagemin[ deviceId ].push( _voltagemin );
			voltagemax[ deviceId ].push( _voltagemax );

			currentmin[ deviceId ].push( _currentmin );
			currentmax[ deviceId ].push( _currentmax );	
		}

		data = data.substr( data.indexOf(";") + 1);
			
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


		if( cfgDevices[ i ].status == "running" ) {
			
			
			serialPort.write("8,0," + i + ",1.2,0,100,100,2;");
			console.log( "8,0," + i + ",1.2,0,100,100,2;" );
		}
	}
	
}, 600000 );


setInterval( function() {

	for( var i in cfgDevices ) {

		var data;

		if( cfgDevices[ i ].status == "running" && times[ i ] && times[ i ].length > 0 ) {

			
			data = [];

			for( var j = 0, l = powers[ i ].length; j < l; j ++ ) {
				data.push( [

					{
						time: times[ i ][ j ],
						voltage: voltages[ i ][ j ],
						current: currents[ i ][ j ],
						power: powers[ i ][ j ],
						powermin: powermin[ i ][ j ],
						powermax: powermax[ i ][ j ],
						currentmin: currentmin[ i ][ j ],
						currentmax: currentmax[ i ][ j ],
						voltagemin: voltagemin[ i ][ j ],
						voltagemax: voltagemax[ i ][ j ]
					}
				] );
//				 + "\t" +  + "\t" +  + "\t" +  + "\t" + voltagesminmax[ i ][ j ][ 1 ] + "\t" + voltagesminmax[ i ][ j ][ 2 ] + "\t" + currentsminmax[ i ][ j ][ 1 ] + "\t" + currentsminmax[ i ][ j ][ 2 ] + "\t" + powersminmax[ i ][ j ][ 1 ] + "\t" + powersminmax[ i ][ j ][ 2 ];
			}



			var postString = JSON.stringify( {
		   		cellName: getFilename( cfgDevices[ i ] ),
		   		data: data		   		
		   	} );

			var options = {
			  hostname: '127.0.0.1',
			  port: 3001,
			  path: '/saveData',
			  method: 'POST',
			  headers: {
			    'Content-Type': 'application/json',
			    'Content-Length': postString.length
			  }
			};

			var req = http.request(options);
			req.on('error', (e) => {
			  console.log(`problem with request: ${e.message}`);
			});
			// write data to request body
			req.write(postString);
			req.end();

/*

			xmlhttp = new XMLHttpRequest();
		   	xmlhttp.open("POST","127.0.0.1:3001", true);
		   	xmlhttp.send( JSON.stringify( {
		   		cellName: getFilename( cfgDevices[ i ] ),
		   		data: data		   		
		   	} ) );*/
			
			times[ i ] = [];
			powers[ i ] = [];
			currents[ i ] = [];
			voltages[ i ] = [];

			powermin[ i ] = [];
			currentmin[ i ] = [];
			voltagemin[ i ] = [];


			powermax[ i ] = [];
			currentmax[ i ] = [];
			voltagemax[ i ] = [];

		}
	}

}, 2000 );


function getFilename( device ) {
	return device.name.replace(/[^a-zA-Z0-9_]+/ig,'') + "_" + device.starttime;
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

	req.params[ '0' ] = parseInt( req.params[ '0' ] );

	updateConfig( req.params[ '0' ], config );
	deleteConfig( req.params[ '0' ] );

	powers[ req.params[ '0' ] ] = [];
	currents[ req.params[ '0' ] ] = [];
	voltages[ req.params[ '0' ] ] = [];

	powermin[ req.params[ '0' ] ] = [];
	currentmin[ req.params[ '0' ] ] = [];
	voltagemin[ req.params[ '0' ] ] = [];

	powermax[ req.params[ '0' ] ] = [];
	currentmax[ req.params[ '0' ] ] = [];
	voltagemax[ req.params[ '0' ] ] = [];

	res.send("ok");
});

app.get(/\/updateChannel\/([0-9]+)/, function( req, res ) {

	if( cfgDevices[ req.params[ '0' ] ].status == "running" ) {
		var config = req.query;
		updateConfig( req.params[ '0' ], config );
		res.send("ok");
	}
});

function deleteConfig( deviceId ) {
	delete cfgDevices[ deviceId ];
	fs.writeFileSync( "config.json", JSON.stringify( cfgDevices ) );

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

			arduino.send("9,0," + deviceId + ",1;");
			if( config.samplerate ) {
				arduino.send( "6,0," + deviceId + "," + config.samplerate + ";" );
			}
		break;

		case 'paused':
			arduino.send( "9,0," + deviceId + ",0;");
			arduino.send( "6,0," + deviceId + ",-2;" );
		break;

		case 'stopped':
			arduino.send( "9,0," + deviceId + ",0;");
			arduino.send( "6,0," + deviceId + ",-3;" );
		break;
	}

}


var connections = [];
/*
var WebSocketServer = require('ws').Server, 
	wss = new WebSocketServer({ port: 8080 });

	*/
/*
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
							data = { powers: [], currents: [], voltages: [], currentsminmax: [], voltagesminmax: [], powersminmax: [] };

						for( var j = 1; j < file.length; j ++ ) {
							line = file[ j ].split("\t");

							data.powers.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 3 ] )  ]  );
							data.currents.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 2 ] )  ]  );
							data.voltages.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 1 ] ) ]  );

							data.currentsminmax.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 6 ] ), parseFloat( line[ 7 ] )  ] );
							data.voltagesminmax.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 4 ] ), parseFloat( line[ 5 ] )  ] );
							data.powersminmax.push( [ parseInt( line[ 0 ] ), parseFloat( line[ 8 ] ), parseFloat( line[ 9 ] )  ] );

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

					var index = 0;
					for( var j = 0; j < powers[ i ].length; j ++ ) {
						if( powers[ i ][ j ][ 0 ] > message.latest[ i ] ) {
							index = j;
							break;
						}
					}

					obj.data.push( { 
						deviceId: i,
						data: { 
							powers: powers[ i ].slice( j ), 
							voltages: voltages[ i ].slice( j ), 
							currents: currents[ i ].slice( j ) ,
							currentsminmax: currentsminmax[ i ].slice( j ) ,
							voltagesminmax: voltagesminmax[ i ].slice( j ) ,
							powersminmax: powersminmax[ i ].slice( j ) 

						} 
					} );
					

					message.latest[ i ] = powers[ i ][ powers[ i ].length - 1 ][ 0 ];
				}
			}


			ws.send( 
				JSON.stringify( obj )
			);
		}


  });

  
});
*/