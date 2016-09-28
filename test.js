
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
var conversion = [ [ 1.0042e-06, -0.0096653 ],  [ -1.7334e-08, -0.0068564  ] ];

var parameterSetDelay = 15000; // Every 30 seconds

var parameterSets = [
	[ "PERTurbation:DCDC:DUTYcycle", [ 0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80 ] ],
	[ "PERTurbation:DCDC:LENGth", [ 10, 20, 50, 100 ] ]
];

var sets = [];

// http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}


function createSet( i, set ) {
	
	for( var j = 0; j < parameterSets[ i ][ 1 ].length; j ++ ) {

		set[ i ] = parameterSets[ i ][ 1 ][ j ];

		if( i == parameterSets.length  - 1 ) {
			sets.push( set.slice( 0 ) );
		} else { // Level deeper

			createSet( i + 1, set );
		}
	}
}

createSet( 0, [] );

sets = shuffleArray( sets );
var ended = false;

function nextParameterSet() {

	var commands = [];
	var paramString = "";
	var i = 0;

	if( sets.length == 0 ) {
		fs.writeFileSync("DCDC_" + startTime + ".itx", itx.getFile() );
		ended = true;
		return;
	}

	sets.shift().map( function( parameter, index ) {

		commands.push( parameterSets[ index ][ 0 ] + " " + parameter + ";");
		paramString += "_" + parameter;
	});

	commands.push("MEASurement:TRACking:REGUlation:FORWardbackward 0.92;");
	commands.push("MEASurement:TRACking:REGUlation:BACKwardbackward 1;");
	commands.push("DCDC:VALUe 65;");
	commands.push("PERTurbation:DCDC:INTErval 5000;" );
	commands.push("MEASurement:TRACking:STARt;");
	
	voltage = new Waveform();
	current = new Waveform();
	time = new Waveform();
	duty = new Waveform();
	launchTime = Date.now();

	itx.newWave("voltage" + paramString ).setWaveform( voltage );
	itx.newWave("current" + paramString ).setWaveform( current );
	itx.newWave("time_s" + paramString ).setWaveform( time );
	itx.newWave("duty" + paramString ).setWaveform( duty );

	sendCommands( commands );
}


function sendCommands( commands ) {

	var command = commands.shift();
	serialPort.write( command );

	if( commands.length == 0 ) {
		dataReady = true;
		arm = true;
		return;
	}

	setTimeout( function() { // 10 commands per second
		sendCommands( commands );
	}, 100 );
}


// Current slope: 
// Current offset:  0.000392422
// Voltage slope: 1.036e-06
// Voltage offset:  -0.0213994 (21mv !!)

var startTime = Date.now();

serialPort.on("open", function() {

	setInterval( function() {
		
		fs.writeFileSync("DCDC_" + startTime + ".itx", itx.getFile() );

	}, 10000 );

	setInterval( nextParameterSet, parameterSetDelay );
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

	var lastDuty = 0;

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
					console.log("USB connection synchronized. Starting tracking...");
					//arm = true;
					//serialPort.write("MEASurement:TRACking:STARt;")

					nextParameterSet();

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

					for( var i = 0; i < 2; i ++ ) { //4 first byte are data
						
						data[ i ] = conversion[ i % 2 ][ 0 ] * data[ i ] + conversion[ i % 2 ][ 1 ];
						if( i % 2 == 1 ) {
							data[ i ] *= 1000;
						}
					
					}

					arm = true;
					indexGeneral = 0;
				
					voltage.push( data[ 0 ] );
					current.push( data[ 1 ] );
					time.push( ( Date.now() - start ) / 1000 );
					duty.push( data[ 2 ] );

					if( data[ 2 ] == 480 || data[ 2 ] == 0 ) {
						colorFunc = 'black';
					} else if( data[ 2 ] > lastDuty ) {
						colorFunc = 'green';
					} else {
						colorFunc = 'red';
					}



					if( ended ) {

						console.log("DONE");
					} else {

						console.log( colors[ colorFunc ]( data[ 0 ], data[ 1 ], data[ 2 ] ) );		
					}

					
					lastDuty = data[ 2 ];
					
				}

	
			}

			
		}
		
	});
});
