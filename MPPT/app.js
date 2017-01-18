
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

var makingIv = false, ivResolver;
var cfgDevices, cfgChannels, params;

var status = JSON.parse( fs.readFileSync( 'status.json' ) );
var params = JSON.parse( fs.readFileSync( 'params.json' ) );
var config = JSON.parse( fs.readFileSync( 'config.json' ) );

var silentClose = false;

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

			if( trackData[ i ][ j ].date.length == 0 ) {
				continue;
			}

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

	req.on( 'error', function() {

		for( var i in trackData ) {

			for( var j in trackData[ i ] ) {

				for( var k in trackData[ i ][ j ] ) {
					trackData[ i ][ j ][ k ] = [];
				}
			}
		}

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
function saveDevices( ) {

	var ini = "";

	for( var i in connectedDevices ) {
		ini += i + "\n";
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

		loadDevice( iniLine ).then( function() {

		}, function() {
			console.log("Connection from ini file has failed...");
		});
	} );
}


function loadDevice( portName ) {

	connectedDevices[ portName ] = {
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

				console.log( err );
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

			connection.handshake = handshake( connection, portName, connection ).then( function( handshakeResult ) {
				console.log("Handshake is a success");
				var chanId;

				for( var i = 0; i < connection.calibration.length; i ++ ) {

					chanId = connection.calibration[ i ].channelId;

					status[ connection.name ] = status[ connection.name ] || {};
					status[ connection.name ][ chanId ] = status[ connection.name ][ chanId ] || {};

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

	return code * calibration.ADCSlopeVoltage + calibration.ADCOffsetVoltage;
}

function getDACCodeFromVoltage( voltage, calibration ) {

	return Math.round( ( voltage - calibration.DACOffsetVoltage ) / calibration.DACSlopeVoltage );
}



function getCodeFromVoltage( voltage, calibration ) {

	return Math.round( ( voltage - calibration.ADCOffsetVoltage ) / calibration.ADCSlopeVoltage );
}


function getDACCodeFromDeltaVoltage( voltage, calibration ) {
	return Math.round( voltage / calibration.DACSlopeVoltage );
}

function getCurrentFromCode( code, calibration ) {
	return code * calibration.ADCSlopeCurrent + calibration.ADCOffsetCurrent;
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

		if( silentClose ) {
			silentClose = false;
			return;
		}
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

			if( data2.indexOf( '<IV' ) > -1 ) {


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

					var voltage = new Waveform().setXUnit("V");
					var current = new Waveform().setXUnit("A");

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

					var folderpath = "data/IVCurves/" + getFilename( statusChannel ) + "/";

					try {
					    fs.accessSync(folderpath, fs.F_OK);
					    // Do something
					} catch (e) {

						fs.mkdirSync( folderpath );
					}


					fs.writeFile( folderpath + time + ".itx", itx.getFile(), function( err ) {

						if( err ) {
							console.error("Can not save IV curve. Error was " + err.toString() );
						}

						ivResolver();

					} );
				}

			} else if( data2.indexOf("<TRAC" ) > -1 ) {

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

					trackData[ connection.name ] = trackData[ connection.name ] || {};
					trackData[ connection.name ][ deviceId ] = trackData[ connection.name ][ deviceId ] || { date: [], v: [], c: [], vmin: [], vmax: [], cmin: [], cmax: [], p: [] };

//console.log( data2, voltage, current, deviceId );
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


function handshake( connection, portName, response ) {
	return new Promise( function( resolver, rejecter ) {

		var data = "",
			listener = function( dataReceived ) {

	  		data += dataReceived.toString('ascii');
	  		if( data.indexOf(";") > -1 ) {

					if( connectionTimeout ) {
						clearTimeout( connectionTimeout );
					}

			  	connection.connection.removeListener( 'data', listener );
		  		var dataname = cleanupname( data.replace("*IDN? ", "").replace("*idn", "") );
		  		var filename = cleanupfilename( dataname ) + ".json",
		  			filepath = "./calibrations/" + filename;
					connection.name = dataname;

		  		fs.open( filepath, "r", function( err ) {

		  			if( err ) {

		  				response.error = true;
		  				response.errorText = "No calibration file was found for " + dataname + ". Name of missing file is " + filename;
							silentClose = true;
							connection.connection.close( function() {
									rejecter( response );
							});



		  			} else {
						console.log('Reading calibration file...');
		  				connection.calibration = JSON.parse( fs.readFileSync( filepath ) );
		  				resolver( response );
		  			}

		  		} );
			}
	  	};


	  	connection.connection.on('data', listener );

			var connectionTimeout = setTimeout( function() {
  				response.error = true;
  				response.errorText = "Device is not responding to the *IDN? command. Try resetting or rebooting the device";
					silentClose = true;
					connection.connection.close( function() {
							rejecter( response );
					});


			}, 5000 );

	  	setTimeout( function() {
	  		console.log("Sending IDN command");
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


app.get("/listMeasurements", function( req, res ) {

	var options = {
	  hostname: '127.0.0.1',
	  port: params.influxdb.serverport,
	  path: '/showMeasurements',
	  method: 'GET'
	};

	var req = http.request(options);
	req.on('error', function( err ) {
		console.log( "Error with request: " + err.message );
	});

	res.type("application/json");

	req.on( "response", function( response ) {

		var body = '';

		response.on("data", function( d ) {
			body += d.toString('utf8');
		});

		response.on("end", function( ) {

			try {
				body = JSON.parse( body );
			} catch ( e ) {
				body = [];
			}

			var regex = /(.*)_([0-9]*)$/;

			body = body.map( function( line ) {

				var res = regex.exec( line.name );
				if( res ) {
					return { fullname: line.name, name: res[ 1 ], start: parseInt( res[ 2 ] ) };
				}

			} );

			body.sort( function( a, b ) {
				return a.start - b.start;
			});

			res.send( body );
		});
	} );

	req.end();
} );



app.get("/connect", function( req, res ) {

	res.type("application/json");

	var portName = req.query.port;

	loadDevice( portName, false ).then( function( response ) {

		saveDevices( );

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

app.get("/removeDevice", function( req, res ) {

	var deviceName = req.query.deviceName;
	for( var i in connectedDevices ) {
		if( connectedDevices[ i ].name == deviceName ) {
			delete connectedDevices[ i ];
			saveDevices();
		}
	}
} );


app.get('/getCurrentStatus', function( req, res ) {
	res.type("application/json");
	res.send( { channels: cfgChannels, devices: cfgDevices } );
});

app.get(/\/startChannel\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/, function( req, res ) {
	var config = req.query;
	config.status = "running";
	config.starttime = Date.now();


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


	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].date = new Waveform();
	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].p = new Waveform();
	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].c = new Waveform();
	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].v = new Waveform();

	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].vmin = new Waveform();
	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].vmax = new Waveform();
	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].cmin = new Waveform();
	trackData[ req.params[ '0'] ][ req.params[ '1' ] ].cmax = new Waveform();


	saveStatus();
	//deleteConfig( req.params[ '0' ], req.params[ '1' ] );

	res.send("ok");
});


app.get(/\/download\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)\/([A-Za-z0-9,_-]+)/, function( req, res ) {

	var measurement = req.params[ '0' ];
	var grouping = parseInt( req.params[ '1' ] );
	var format = req.params[ '2' ];

	var postString = JSON.stringify( {
		measurement: measurement,
		grouping: grouping
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
	req.write( postString );

	req.on('error', function( err ) {
		console.log( "Error with request: " + err.message );
	});




	req.on("response", function( response ) {

		var body = "";

		response.on( "data", function( bdy ) {

			body += bdy.toString('utf8');

		});

		response.on( "end", function() {

			response = JSON.parse( body );

			if( response.status == 0 ) {
					res.send();
					return;
			}

			switch( format ) {

				case 'itx':
					var itx = new itxBuilder.ITXBuilder();
					var name;
					for( var i in response.data ) {
						name = i;
						if( name == 'time' ) {
							name = 'time_h';
						}
						itx.newWave( name ).setWaveform( new Waveform().setData( response.data[ i ] ) )
					}
					res.type("application/itx");
					res.set("Content-disposition", 'filename="' + measurement + '.itx"');
					res.send( itx.getFile() );
				break;

				case 'csv':

					var csv = "";

					for( var i in response.data ) {
						csv += i;
						csv += ",";
					}

					csv += "\n";

					for( var i = 0; i < response.data.time.length; i++ ) {

						for( var j in response.data ) {
							csv += response.data[ j ][ i ];
							csv += ",";
						}

						csv += "\n";
					}

					res.type("text/csv");
					res.set("Content-disposition", 'filename="' + measurement + '.csv"');
					res.send( csv );
				break;

			}


		} );

	})


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

var ivinterval = {};

function updateStatus( instrument, channelId, config ) {

	if( ! config ) {
		return;
	}



	config.sendrate = parseInt( config.sendrate );
	config.trackrate = parseInt( config.trackrate );
	config['iv-repetition'] = parseInt( config['iv-repetition'] );
	config['iv-from'] = parseInt( config['iv-from'] );
	config['iv-to'] = parseInt( config['iv-to'] );
	config['iv-scanrate'] = parseInt( config['iv-scanrate'] );
	config['iv-nbpoints'] = parseInt( config['iv-nbpoints'] );
	config['iv-delay'] = parseInt( config['iv-delay'] );
	config['forbackthreshold'] = parseFloat( config['forbackthreshold'] );
	config['backforthreshold'] = parseFloat( config['backforthreshold'] );


	var device, portName;
	for( var i in connectedDevices ) {
		if( connectedDevices[ i ].name == instrument ) {
			device = connectedDevices[ i ];
			portName = i;
			break;
		}
	}

	if( ! ivinterval[ portName ] ) {
		ivinterval[ portName ] = {};
	}

	if( ! device ) {
		return false;
	}


	for( var i = 0; i < device.calibration.length; i++ ) {

		if( device.calibration[ i ].channelId == channelId ) {

			if( ivinterval[ portName ][ channelId ] && config["iv-repetition"] == 0 ) {
				clearInterval( ivinterval[ portName ][ channelId ] );
			} else if( ! ivinterval[ portName ][ channelId ] && config["iv-repetition"] > 0 && config[ 'iv-repetition'] !== null && ! isNaN( config[ 'iv-repetition' ] ) ) {

				ivinterval[ portName ][ channelId ] = setInterval( function() {

					if( status[ instrument ][ channelId ].status == 'running' ) {
						queue[ portName ].queue.push( [ "MEASurement:IMMEdiate:IV", false, channelId ] );

						processQueue( queue[ portName ], portName );

						makingIv = new Promise( function( resolver ) {

							ivResolver = resolver;

						}).then( function() {

							makingIv = false;
							processQueue( queue[ portName ], portName );

						});
					}



				}, Math.min( Math.pow(2,31) - 1, config["iv-repetition"] ) );
			}

			status[ instrument ][ channelId ] = config;
			sendStatus( device, channelId, config, device.calibration[ i ], status[ instrument ][ channelId ], portName );
		}
	}

	saveStatus();
}

function saveStatus() {
	fs.writeFileSync( "status.json", JSON.stringify( status, undefined, "\t" ) );
}


Number.prototype.noExponents= function(){
    var data= String(this).split(/[eE]/);
    if(data.length== 1) return data[0];

    var  z= '', sign= this<0? '-':'',
    str= data[0].replace('.', ''),
    mag= Number(data[1])+ 1;

    if(mag<0){
        z= sign + '0.';
        while(mag++) z += '0';
        return z + str.replace(/^\-/,'');
    }
    mag -= str.length;
    while(mag--) z += '0';
    return str + z;
}


var queue = {};


function sendStatus( instrument, channelId, config, calibration, status, instrumentName ) {

	var connection = instrument.connection;

	var commands = {};

	queue[ instrumentName ] = queue[ instrumentName ] || { processing: false, queue: [] };


	queue[ instrumentName ].queue.push( [ "MEASurement:TRACk:SENDrate", config.sendrate, channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:TRACk:RATE", config.trackrate, channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:IV:STARt", getDACCodeFromVoltage( parseFloat( config["iv-from"] ), calibration ), channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:IV:STOP", getDACCodeFromVoltage( parseFloat( config["iv-to"] ), calibration ), channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:IV:SCANrate", getDACCodeFromDeltaVoltage( config["iv-scanrate"], calibration ), channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:IV:NBPOints", config["iv-nbpoints"], channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:IV:DELAy", config["iv-delay"], channelId ] );
/*
	commands["CALIbration:DACOffset"] = calibration.DACOffset;
	commands["CALIbration:DACSlope"] = calibration.DACSlope;
	*/

	queue[ instrumentName ].queue.push( [ "MEASurement:REGUlation:POSItive", config['forbackthreshold'], channelId ] );
	queue[ instrumentName ].queue.push( [ "MEASurement:REGUlation:NEGAtive", config['backforthreshold'], channelId ] );


	queue[ instrumentName ].queue.push( [ "CALIbration:VOLTage:ADCOffset", calibration.ADCOffsetVoltage, channelId ] );
	queue[ instrumentName ].queue.push( [ "CALIbration:VOLTage:ADCSlope", calibration.ADCSlopeVoltage, channelId ] );
	queue[ instrumentName ].queue.push( [ "CALIbration:CURRent:ADCOffset", calibration.ADCOffsetCurrent, channelId ] );
	queue[ instrumentName ].queue.push( [ "CALIbration:CURRent:ADCSlope", calibration.ADCSlopeCurrent, channelId ] );

	queue[ instrumentName ].queue.push( [ "MEASurement:IV:DELAy", config["iv-delay"], channelId ] );


	if( status.status == 'running' ) {

		if( config.holdAt == 'MPPT' ) {
			queue[ instrumentName ].queue.push( [ "MEASurement:MODE", 1, channelId ] );
		} else {
			queue[ instrumentName ].queue.push( [ "MEASurement:TARGet:VOLTage", getCodeFromVoltage( parseFloat( config.holdAt ), calibration ), channelId ] );
			queue[ instrumentName ].queue.push( [ "MEASurement:MODE", 3, channelId ] );	 // Steady voltage
		}

	}

	processQueue( queue[ instrumentName ], instrumentName );
}


function processQueue( queue, portName ) {

	if( queue.processing ) {

		return;
	}

	if( makingIv ) {
		queue.processing = false;
		return;
	}


	var command = queue.queue.shift();


	if( command ) {


		while( command && ( isNaN( command[ 1 ] ) || command[ 1 ] == undefined ) ) {
			command = queue.queue.shift();
		}
	}


	if( ! command ) {

		queue.processing = false;
		setTimeout( function() {

			processQueue( queue, portName );

		}, 10000  );

		return;
	}


	queue.processing = true;

	var string = command[ 0 ] + ":CH" + command[ 2 ];
	if( command[ 1 ] !== false ) {
		string += " " + command[ 1 ].noExponents();
	}
	string += ";";

	connectedDevices[ portName ].connection.write( string, function( err, result ) {

		connectedDevices[ portName ].connection.flush(function() {

			setTimeout( function() {

				queue.processing = false;
				processQueue( queue, portName );

			}, 300 );

		} );

	} );
}
