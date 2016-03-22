
var serial = require("serialport");
var http = require('http');

var extend = require('extend');
var express = require('express');
var app = express();
var fs = require('fs');
var http = require('http');
var Promise = require('bluebird');
var influx = require("./lib/influxserver");
var Waveform = require("./lib/waveform");
var itxBuilder = require("./lib/itxbuilder");
var util = require("./lib/util");

var trackData = {};


var cfgDevices, cfgChannels, params;

var status = JSON.parse( fs.readFileSync( 'status.json' ) );
var params = JSON.parse( fs.readFileSync( 'params.json' ) );
var config = JSON.parse( fs.readFileSync( 'config.json' ) );


influx.setConfig( config.influxdb );
influx.restartServer( );
influx.restartClient( );

function cleanupname( name ) {
	return name
		.trim()
		.replace(";", "")
		.replace("\n", "")
		.replace("\r", "")
}

function cleanupfilename( name ) {
	return name
			.replace(/[^0-9A-Za-z_-]/g, "_");
}


var ip = util.getIp();

// Sending data to the influx db
setInterval( function() {

	var alldata = [];

	for( var i in trackData ) {

		for( var j in trackData[ i ] ) {

			var data = [];

			for( var k = 0, l = trackData[ i ][ j ].date.length; k < l; k ++ ) {
				data.push( [ {

					time: trackData[ i ][ j ].date[ k ],
					voltage: trackData[ i ][ j ].v[ k ],
					current: trackData[ i ][ j ].c[ k ],
					power: trackData[ i ][ j ].p[ k ],
					currentmin: trackData[ i ][ j ].cmin[ k ],
					currentmax: trackData[ i ][ j ].cmax[ k ],
					voltagemin: trackData[ i ][ j ].vmin[ k ],
					voltagemax: trackData[ i ][ j ].vmax[ k ]

				} ] );
			}

			alldata.push( {
		   		cellName: getFilename( status[ i ][ j ] ),
		   		data: data
		   	} );
		}
	}

	var postString = JSON.stringify( alldata );

	var options = {
	  hostname: ip,
	  port: params.influxdb.serverport,
	  path: '/saveData',
	  method: 'POST',
	  headers: {
	    'Content-Type': 'application/json',
	    'Content-Length': postString.length
	  }
	};

	var req = http.request(options);
	req.on('abort', function( err ) {

		for( var i in trackData ) {

			for( var j in trackData[ i ] ) {

				for( var k in trackData[ i ][ j ] ) {
					trackData[ i ][ j ][ k ] = [];
				}
			}
		}

		console.log( "Error with request: " + err.message );
	});

	req.on('response', function( response ) {

		if( response.error ) {

			// Error handling
		} else {

				
			for( var i in trackData ) {

				for( var j in trackData[ i ] ) {

					for( var k in trackData[ i ][ j ] ) {
						trackData[ i ][ j ][ k ] = [];
					}
				}
			}
		}
	} );

	req.write( postString );
	req.end();

}, 10000 );


function getFilename( status ) {
	if( ! status.name ) {
		return "";
	}

	return status.name.replace(/[^a-zA-Z0-9_]+/ig,'') + "_" + status.starttime;
}




app.use(express.static('public'));
var server = app.listen(3000);

app.get('/', function (req, res) {
	return;
});


var connectedDevices = {};
function saveDevice( portname, setupname ) {

	var ini = "";

	for( var i in connectedDevices ) {
		ini += i + "=" + connectedDevices[ i ].name + "\n";
	}

	fs.writeFileSync( "devices.ini", ini );
}

function loadDevices() {

	var ini = fs.readFileSync( "./devices.ini", 'ascii' );
	ini = ini.split("\n");

	ini.map( function( iniLine ) {

		if( iniLine == "" ) {
			return;
		}

		iniLine = iniLine.split("=");

		loadDevice( iniLine[ 0 ], iniLine[ 1 ] ).then( function() {

		}, function() {
			console.log("Connection from ini file has failed...");
		});
	} );
}


function loadDevice( portName, instrumentName ) {


	connectedDevices[ portName ] = { 
		name: instrumentName, 
		portName: portName,
		connection: new serial.SerialPort( portName, params.serial.parameters ),
		error: false,
		errorText: false
	};

	registerSerialEvents( connectedDevices[ portName ], portName );

	return openConnection( connectedDevices[ portName ], portName );

}

function openConnection( connection, portName ) {

	return new Promise( function( resolver, rejecter ) {

		connection.connection.open( function( err ) {

			connection.error = false;

			if( err ) {
				connection.error = true;
				connection.errorText = err.toString();


				setTimeout( function() {

					console.error("Timeout while connecting to the device");

					openConnection( connection, portName ).then( function() {}, function() {
						console.error("Connection to " + portName + " failed.");
					});

				}, params.serial.retryInterval, false );

				rejecter( connection );

				return;
			} 

			connection.handshake = handshake( connection, portName, connection, connection.name ).then( function( handshakeResult ) {

				var chanId;

				for( var i = 0; i < connection.calibration.length; i ++ ) {

					chanId = connection.calibration[ i ].channelId;

					status[ connection.name ] = status[ connection.name ] || {};

					updateStatus( connection.name, chanId, status[ connection.name ][ chanId ] );	
				}

				resolver( handshakeResult );
			}, function( handshakeResult ) {


				console.error("Handshake has failed");
				rejecter( handshakeResult );
			});
		} );
	} );
}

/*
function getVoltageFromCode( delta, calibration ) {
	return Math.round( delta * calibration.DACSlope );
}*/

function getVoltageFromCode( code, calibration ) {
	
	return code * calibration.DACSlope + calibration.DACOffset;
}

function getCodeFromVoltage( voltage, calibration ) {
	return Math.round( ( voltage - calibration.DACOffset ) / calibration.DACSlope );
}

function getCodeFromDeltaVoltage( voltage, calibration ) {
	return Math.round( voltage / calibration.DACSlope );
}

function getCurrentFromCode( code, calibration ) {
	return code * calibration.ADCSlope + calibration.ADCOffset;
}

function getCodeFromCurrent( current, calibration ) {
	var code = ( current - calibration.ADCOffset ) / calibration.ADCSlope;	
	return parseInt( code );
}


function registerSerialEvents( connection, portName ) {

	connection.connection.on( "error", function() {
		connection.error = true;
		connection.errorText = "Impossible to connect to device";
	} );

	connection.connection.on( "close", function() {

		connection.error = true;
		connection.errorText = "Connection lost";

		setTimeout( function() {
			openConnection( connection, portName ).then( function() {}, function() {
				console.error("Connection to " + portName + " failed.");
			});

		}, params.serial.retryInterval, false );

	} );


	connection.connection.on( "data", function( d ) {

		connection.data = connection.data || "";

		var data2;
		connection.data += d.toString('ascii');

		while( connection.data.indexOf(";") > -1 ) {

			data2 = connection.data
				.substr( 0, connection.data.indexOf(";") )
				.replace( ';', '' );

			if( data2.indexOf( 'IV' ) > -1 ) {

				
				data2 = data2.replace(">", "");
				data2 = data2.split(",");

				data2.shift();
				var deviceId = data2.shift();

				var statusChannel = status[ connection.name ][ deviceId ];

				if( statusChannel ) {


					var calibration;
					for( var i = 0, l = connection.calibration.length; i < l; i ++ ) {
						if( connection.calibration[ i ].channelId == deviceId ) {
							calibration = connection.calibration[ i ]
						}
					}


					var nbPoints = data2.shift();

					var nbpoints = data2.length / 2;

					var voltage = new Waveform().setUnit("V");
					var current = new Waveform().setUnit("A");

					for( var i = 0; i < nbpoints; i ++ ) {
						voltage.push( getVoltageFromCode( parseInt( data2[ i ] ), calibration ) );
					}

					for( var i = nbpoints; i < nbpoints * 2; i ++ ) {
						current.push( getCurrentFromCode( parseInt( data2[ i ] ), calibration ) );
					}


					var itx = new itxBuilder.ITXBuilder();

					var itxw = itx.newWave( "voltage" );
					itxw.setWaveform( voltage );

					var itxw = itx.newWave( "current" );
					itxw.setWaveform( current );
					
					var time = Math.round( ( Date.now() - statusChannel.starttime ) / 1000 );

					fs.writeFile("data/IVCurves/" + getFilename( statusChannel ) + "/" + time + ".itx", itx.getFile(), function( err ) {

						if( err ) {
							console.error("Can not save IV curve. Error was " + err.toString() );
						}

					} );
				}

			} else if( data2.indexOf("TRAC" ) > -1 ) {

				//fs.appendFileSync('run.txt', data2 + "\n" );

				var calibration;
//console.log( data2 );
				data2 = data2.split(',');	

				var deviceId = parseFloat( data2[ 1 ] );

				if( connection.calibration ) {

					for( var i = 0, l = connection.calibration.length; i < l; i ++ ) {
						if( connection.calibration[ i ].channelId == deviceId ) {
							calibration = connection.calibration[ i ]
						}
					}
					if( ! calibration ) {
						return;
					}

					var voltage = Math.round( getVoltageFromCode( parseInt( data2[ 2 ] ), calibration ) * 1000000 )  / 1000000;
					var current = Math.round( getCurrentFromCode( parseInt( data2[ 3 ] ), calibration ) * 1000000 ) / 1000000;
					
					var vmin = Math.round( getVoltageFromCode( parseInt( data2[ 4 ] ), calibration ) * 1000000 ) / 1000000;
					var vmax = Math.round( getVoltageFromCode( parseInt( data2[ 5 ] ), calibration ) * 1000000 ) / 1000000;
					
					var cmin = Math.round( getCurrentFromCode( parseInt( data2[ 6 ] ), calibration ) * 1000000 ) / 1000000;
					var cmax = Math.round( getCurrentFromCode( parseInt( data2[ 7 ] ), calibration ) * 1000000 ) / 1000000;
console.log( deviceId, voltage, current, voltage * current );
					trackData[ connection.name ] = trackData[ connection.name ] || {};
					trackData[ connection.name ][ deviceId ] = trackData[ connection.name ][ deviceId ] || { date: [], v: [], c: [], vmin: [], vmax: [], cmin: [], cmax: [], p: [] };


					trackData[ connection.name ][ deviceId ].date.push( Date.now() );
					trackData[ connection.name ][ deviceId ].p.push( Math.round( current * voltage * 1000000 ) / 1000000 );
					trackData[ connection.name ][ deviceId ].c.push( current );
					trackData[ connection.name ][ deviceId ].v.push( voltage );
					
					trackData[ connection.name ][ deviceId ].vmin.push( vmin );
					trackData[ connection.name ][ deviceId ].vmax.push( vmax );
					trackData[ connection.name ][ deviceId ].cmin.push( cmin );
					trackData[ connection.name ][ deviceId ].cmax.push( cmax );
				}
			}

			connection.data = connection.data.substr( connection.data.indexOf(";") + 1);
				
		}	
	});
}


function handshake( connection, portName, response, nameCheck ) {

	return new Promise( function( resolver, rejecter ) {

		var data = "",
			listener = function( dataReceived ) {

	  		data += dataReceived.toString('ascii');

	  		if( data.indexOf(";") > -1 ) {

			  	connection.connection.removeListener( 'data', listener );
		  	
		  		var dataname = cleanupname( data );

		  		if( nameCheck && nameCheck !== dataname ) {
		  			response.error = true;
		  			response.errorText = "Handshake has failed. The wrong device seem to be connected to this port. This can happen is you have switched the USB port of the device. Try removing the device and readding it.";
		  			rejecter( response );
		  		} else { // Discovery mode => always ok
		  			response.name = dataname;
		  		}

		  		var filename = cleanupfilename( dataname ) + ".json",
		  			filepath = "./calibrations/" + filename;

		  		fs.open( filepath, "r", function( err ) {

		  			if( err ) {

		  				response.error = true;
		  				response.errorText = "No calibration file was found for " + dataname + ". Name of missing file is " + filename;

		  				rejecter( response );

		  			} else {

		  				connection.calibration = JSON.parse( fs.readFileSync( filepath ) );
		  				resolver( response );
		  			}

		  		} );
			}
	  	};

	  	connection.connection.on('data', listener );


	  	setTimeout( function() {
	  		console.log("IDN");
		  	connection.connection.write("*IDN?;");	
	  	}, 2000);
	} );
}


loadDevices();

app.get("/params", function( req, res ) {
	res.type("application/json");
	res.send( params );
} );

app.get("/discover", function( req, res ) {

	serial.list(function( err, ports ) {
	  	
	  var available = [];

	  ports.forEach(function(port) {

	  	available.push( {
	  		name: port.comName,
	  		pnpid: port.pnpId,
	  		manufacturer: port.manufacturer
	  	} );

	  } );

	  res.type("application/json");
	  res.send( available );

	} );
} );

app.get("/connect", function( req, res ) {

	res.type("application/json");

	var portName = req.query.port;

	loadDevice( portName, false ).then( function( response ) {

		saveDevice( portName, response.name );

		res.send( response );
	}, function( response ) {

		res.send( response );
	} );
} );

app.get("/getChannels", function( req, res ) {

	res.type("application/json");
	
	var allChannels = {};
	var name;

	for( var i in connectedDevices ) {

		name = connectedDevices[ i ].name;
		allChannels[ name ] = [];
		
		status[ name ] = status[ name ] || {};

		if( connectedDevices[ i ].calibration && ! connectedDevices[ i ].error ) {
			
			for( var j = 0; j < connectedDevices[ i ].calibration.length; j ++ ) {
				
				status[ name ][ connectedDevices[ i ].calibration[ j ].channelId ] = status[ name ][ connectedDevices[ i ].calibration[ j ].channelId ] || {};
				allChannels[ name ].push( 
					extend( 
						{},
						params.status.default,
						status[ name ][ connectedDevices[ i ].calibration[ j ].channelId ],
						connectedDevices[ i ].calibration[ j ],
						{ filename: getFilename( status[ name ][ connectedDevices[ i ].calibration[ j ].channelId ] ) }
					)
				);	
			}	
		}
	}
	
	res.send( allChannels );
} );

app.get("/getConnectedDevices", function( req, res ) {

	res.type("application/json");
	res.send( connectedDevices );

} );

app.get('/getCurrentStatus', function( req, res ) {
	res.type("application/json");
	res.send( { channels: cfgChannels, devices: cfgDevices } );
});

app.get(/\/startChannel\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/, function( req, res ) {
	var config = req.query;
	config.status = "running";
	config.starttime = Date.now();

	// Create IV folder
	fs.mkdir("data/IVCurves/" + getFilename( config ) + "/", function( err ) {

		if( err ) {
			console.error("Could not create folder. Error was: " + err.toString() );
		}
	});

	updateStatus( req.params[ '0' ], req.params[ '1' ], config );
	res.send("ok");
});

app.get(/\/pauseChannel\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/, function( req, res ) {
	var config = req.query;
	config.status = "paused";
	updateStatus( req.params[ '0' ], req.params[ '1' ], config );
	res.send("ok");
});

app.get(/\/stopChannel\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/	, function( req, res ) {

	var config = req.query;
	config.status = "stopped";

	updateStatus( req.params[ '0' ], req.params[ '1' ], config );
	delete status[ req.params[ '0'] ][ req.params[ '1' ] ];

	saveStatus();
	//deleteConfig( req.params[ '0' ], req.params[ '1' ] );

	res.send("ok");
});


app.get(/\/downloadChannel\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/, function( req, res ) {

	var instrument = req.params[ '0' ];
	var channelId = req.params[ '1' ];

	var postString = JSON.stringify( {
		cellName: getFilename( status[ instrument ][ channelId ] )
	} );

	var options = {
	  hostname: '127.0.0.1',
	  port: params.influxdb.serverport,
	  path: '/export',
	  method: 'GET',
	  headers: {
	    'Content-Type': 'application/json',
	    'Content-Length': postString.length
	  }
	};

	var req = http.request(options);
	req.on('error', function( err ) {
		console.log( "Error with request: " + err.message );
	});

	req.write( postString );

	req.on( "data", function( response ) {

		response = JSON.parse( response );
		var itx = new itxBuilder.ITXBuilder();

		for( var i in response ) {
			itx.newWave( i ).setWaveform( new Waveform().setData( response[ i ] ) )
		}

		res.send( itx.getFile() );
	} );

	req.end();



});

app.get(/\/updateChannel\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/, function( req, res ) {

	if( status[ req.params[ '0' ] ][ req.params[ '1' ] ].status == "running" ) {

		var config = req.query;
		updateStatus( req.params[ '0' ], req.params[ '1' ], config );
		res.send("ok");
	}
});

app.get("/setInfluxDBConfig", function( req, res ) {

	extend( config.influxdb, req.query );
	influx.setConfig( config.influxdb );

	influx.resetClient();
	saveConfig();
});

app.get("/getInfluxDBConfig", function( req, res ) {

	res.type("application/json");
	res.send( config.influxdb );
} );

function saveConfig() {
	fs.writeFileSync( "config.json", JSON.stringify( config, false, "\t" ) );
}


function updateStatus( instrument, channelId, config ) {	

	if( ! config ) {
		return;
	}

	var device;

	for( var i in connectedDevices ) {
		if( connectedDevices[ i ].name == instrument ) {
			device = connectedDevices[ i ];
			break;
		}
	}

	if( ! device ) {
		return false;
	}

	if( ! device.ivinterval ) {
		device.ivinterval = {};
	}

	for( var i = 0; i < device.calibration.length; i++ ) {

		if( device.calibration[ i ].channelId == channelId ) {
			
			if( device.ivinterval[ channelId ] && config["iv-repetition"] == 0 ) {
				clearInterval( device.ivinterval[ channelId ] );
			} else if( ! device.ivinterval[ channelId ] && config["iv-repetition"] > 0 ) {
				
				device.ivinterval[ channelId ] = setInterval( function() {

					device.connection.write( "MEASurement:IMMEdiate:IV:CH" + channelId + ";" );
				} );
			}

			status[ instrument ][ channelId ] = config;
			sendStatus( device, channelId, config, device.calibration[ i ], status[ instrument ][ channelId ] );
		}
	}

	saveStatus();
}

function saveStatus() {
	fs.writeFileSync( "status.json", JSON.stringify( status ) );
}

function sendStatus( instrument, channelId, config, calibration, status ) {

	var connection = instrument.connection;

	var commands = {};

	if( status.status == 'running' ) {
		commands["MEASurement:MODE"] = 1;
	}

	commands["MEASurement:TRACk:SENDrate"] = config.sendrate;
	commands["MEASurement:TRACk:RATE"] = config.trackrate;
	commands["MEASurement:IV:STARt"] = getCodeFromVoltage( parseFloat( config["iv-from"] ), calibration );
	commands["MEASurement:IV:STOP"] = getCodeFromVoltage( parseFloat( config["iv-to"] ), calibration );
	commands["MEASurement:IV:SCANrate"] = getCodeFromDeltaVoltage( config["iv-scanrate"], calibration );
	commands["MEASurement:IV:NBPOints"] = config["iv-nbpoints"];
	commands["MEASurement:IV:DELAy"] = config["iv-delay"];
/*
	commands["CALIbration:DACOffset"] = calibration.DACOffset;
	commands["CALIbration:DACSlope"] = calibration.DACSlope;
	*/
	commands["CALIbration:VOLTage:ADCOffset"] = calibration.ADCOffsetVoltage;
	commands["CALIbration:VOLTage:ADCSlope"] = calibration.ADCSlopeVoltage;
	commands["CALIbration:CURRent:ADCOffset"] = calibration.ADCOffsetCurrent;
	commands["CALIbration:CURRent:ADCSlope"] = calibration.ADCSlopeCurrent;

	commands["MEASurement:IV:DELAy"] = config["iv-delay"];
	
	for( var i in commands ) {

		if( !isNaN( commands[ i ] ) && commands[ i ] !== undefined ) {

			console.log( i + ":CH" + channelId + " " + Number( "" + commands[ i ] ) + ";" );
			instrument.connection.write( i + ":CH" + channelId + " " + Number( "" + commands[ i ] ) + ";" );
			instrument.connection.drain();	
		}
		
	}
}
