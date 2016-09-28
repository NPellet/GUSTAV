
var Waveform = require("./MPPT/lib/waveform");
var ITXBuilder = require("./MPPT/lib/itxbuilder").ITXBuilder;
var fs = require('fs');
var colors = require('colors');

var itx = new ITXBuilder();

var launchTime;

var arm = true,
	dataReady = false,
	dataComm = "",
	dataCommTreated = "";

var dataStreamLength = 3;


var start;

var voltage, current, time, duty;

var SerialPort = require("serialport").SerialPort;

var serialPort = new SerialPort("/dev/cu.usbmodem1411", {
  baudrate: 115200,
  dataBits: 8, 
  flowControl: true,
  stopBits: 1,
});

var index, indexGeneral;

var data = new Array( 4 );
var conversion = [ [ 1.036e-06, -0.0213994 ],  [ 1.87839e-08, 0.000392422 ] ];


voltage = new Waveform();
current = new Waveform();
time = new Waveform();
duty = new Waveform();
launchTime = Date.now();

itx.newWave( "voltage" ).setWaveform( voltage );
itx.newWave( "current" ).setWaveform( current );
itx.newWave( "time_s" ).setWaveform( time );
itx.newWave( "duty" ).setWaveform( duty );




function sendCommands( commands ) {

	var command = commands.shift();
	serialPort.write( command );

	console.log( command );

	if( commands.length == 0 ) {
		dataReady = true;
		arm = true;
		return;
	}

	setTimeout( function() { // 10 commands per second
		sendCommands( commands );
	}, 1000 );
}


// Current slope: 
// Current offset:  0.000392422
// Voltage slope: 1.036e-06
// Voltage offset:  -0.0213994 (21mv !!)

//var nb = 0, voltage = 0; current = 0;
var startTime = Date.now();

serialPort.on("open", function() {

	setInterval( function() {
		
		fs.writeFileSync("calibration_" + startTime + ".itx", itx.getFile() );

	}, 10000 );
/*
		// Reset data
		dataReady = false;
		serialPort.write("DCDC:DUTY " + duty + ";");
		duty += 1 / 960;

		serialPort.write("MEASurement:TRACking:STARt;")
		dataReady = true;

	}, 3000 );
*/
	indexGeneral = 0;
	start = Date.now();
	console.log("Connection established");
	serialPort.write("COMM:SYNC;"); // Synchronizes

	serialPort.on("data", function( d ) {

		if( ! d ) {
			d = new Buffer();
		}

		if( ! dataReady ) {
			
			dataComm += d.toString('ascii');
			//console.log( dataComm );
			
			while( dataComm.indexOf(";") > -1 ) { // Found a terminator

				dataCommTreated = dataComm.substr( 0, dataComm.indexOf(";") ).replace( ';', '' );
				dataComm = dataComm.substr( dataComm.indexOf(";") + 1 );

				if( dataCommTreated.indexOf('USBSYNC') > -1 ) {
					
					//dataReady = true;
					console.log("USB connection synchronized. Starting aquisition...");
					//arm = true;

					sendCommands( [ "MEAS:VOLT 32768;", "MEASurement:READing:STARt;" ] );
					

				}
			/*	switch( dataCommTreated ) {

					case 'USBSYNC':
						
						//serialPort.write("MEASurement:READing:STARt;")
					break;
				}
*/
				dataReady = true;
			}

		} else {

			index = 0;

			while( index < d.length ) {

				while( arm && index < d.length) {


					if( d[ index ] !== 0x00 ) {
						dataComm += d.toString('ascii');
						console.log('BROKEN STREAM FLUX');
						console.log( d, d[ index ], index );
						dataReady = false;
					//	serialPort.trigger('data');
						return;
					} else {
						indexGeneral++;
					}

					if( indexGeneral == 3 ) {

						arm = false;
						indexGeneral = 0;
						data = new Array( dataStreamLength );

						for( var i = 0; i < dataStreamLength; i++ ) {
							data[ i ] = Number( 0 );
						}

						// Number( 0 ), Number( 0 ), Number( 0 ) ];

						index++;
						break;
					}

					index++;
				}


				while( index < d.length && indexGeneral < dataStreamLength * 4 ) { // Fills up the buffer, 4 byte x dataStreamLength values
					//console.log( d[ index ], ( ( 2 - indexGeneral % 3 ) * 8 ) );

//console.log( ( indexGeneral / 4 ) | 0 , ( ( 3 - indexGeneral % 4 ) * 8 ));
					data[ ( indexGeneral / 4 ) | 0 ] |= d[ index ] << ( ( 3 - indexGeneral % 4 ) * 8 )
					indexGeneral++;
					index++;
				}

				if( indexGeneral == 4 * dataStreamLength ) {

				/*	for( var i = 0; i < 2; i ++ ) { //4 first byte are data
						
						data[ i ] = conversion[ i % 2 ][ 0 ] * data[ i ] + conversion[ i % 2 ][ 1 ];
						if( i % 2 == 1 ) {
							data[ i ] *= 1000;
						}
					
					}*/

					arm = true;
					indexGeneral = 0;
					
			//		voltage = ( voltage * nb + data[ 0 ] ) / ( nb + 1 );
			//		current = ( current * nb + data[ 1 ] ) / ( nb + 1 );
//
//					nb++;

					voltage.push( data[ 0 ] );
					current.push( data[ 1 ] );

					console.log( data[ 0 ], data[ 1 ] );
					/*
					if( data[ 2 ] == 480 || data[ 2 ] == 0 ) {
						colorFunc = 'black';
					} else if( data[ 2 ] > lastDuty ) {
						colorFunc = 'green';
					} else {
						colorFunc = 'red';
					
					}*/

					var colorFunc = 'black';
					//console.log( colors[ colorFunc ]( data[ 0 ], data[ 1 ], data[ 2 ] ) );	
					
					
				}

	
			}

			
		}
		
	});
});
