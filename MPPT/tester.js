
var serialport = require("serialport");
var Waveform = require("./lib/waveform");
var itxBuilder = require("./lib/itxbuilder");
var fs = require("fs");

var serial = new serialport.SerialPort( "/dev/cu.usbmodem1411", {
	"baudrate": 9600,
    "dataBits": 8,  
    "parity": "none",
    "flowControl": true,
    "stopBits": 1
} );

var channelId = 2;

var calibration = { "ADCSlope":9.9949e-06,
					"ADCOffset":-0.020496,
					"DACSlope":0.00099977,
					"DACOffset":-2.0481
				  };

var commands = {};	
commands["MEASurement:TRACk:SENDrate"] = 0;
commands["MEASurement:TRACk:RATE"] = 0;
commands["MEASurement:IV:STARt"] = getCodeFromVoltage( 0.7, calibration );
commands["MEASurement:IV:STOP"] = getCodeFromVoltage( 0, calibration );
commands["MEASurement:IV:SCANrate"] = getCodeFromDeltaVoltage( 1, calibration );
commands["MEASurement:IV:NBPOints"] = 100;
commands["MEASurement:IV:DELAy"] = 1;

commands["CALIbration:DACOffset"] = calibration.DACOffset;
commands["CALIbration:DACSlope"] = calibration.DACSlope;
commands["CALIbration:ADCOffset"] = calibration.ADCOffset;
commands["CALIbration:ADCSlope"] = calibration.ADCSlope;

commands["MEASurement:MODE"] = 1;

var data = "";



serial.on("open", function() {

	var data = "";
	var trackData = {

		p: [],
		c: [],
		v: [],
		vmin: [],
		vmax: [],

		cmin: [],
		cmax: []
	};

	var waveDate = new Waveform();
	var waveP = new Waveform();
	var waveC = new Waveform();
	var waveV = new Waveform();

	var waveVMin = new Waveform();
	var waveVMax = new Waveform();
	var waveCMin = new Waveform();
	var waveCMax = new Waveform();

	var itxFile = new itxBuilder.ITXBuilder();
	itxFile.newWave( "time_ms" ).setWaveform( waveDate );
	itxFile.newWave( "power" ).setWaveform( waveP );
	itxFile.newWave( "current" ).setWaveform( waveC );
	itxFile.newWave( "voltage" ).setWaveform( waveV );
	itxFile.newWave( "vmin" ).setWaveform( waveVMin );
	itxFile.newWave( "vmax" ).setWaveform( waveVMax );
	itxFile.newWave( "cmin" ).setWaveform( waveCMin );
	itxFile.newWave( "cmax" ).setWaveform( waveCMax );
		
	var date = Date.now();

	setInterval( function() {

		fs.writeFileSync( "data_" + date + ".itx", itxFile.getFile() );

	}, 2000 );

	serial.on( "data", function( d ) {

		data = data || "";
		var data2;
		data += d.toString('ascii');

		while( data.indexOf(";") > -1 ) {

			data2 = data
				.substr( 0, data.indexOf(";") )
				.replace( ';', '' );

			if( data2.indexOf( 'IV' ) > -1 ) {

				data2 = data2.replace(">", "");
				data2 = data2.split(",");

				data2.shift();
				var deviceId = data2.shift();

				var statusChannel = status[ connection.name ][ deviceId ];

				if( statusChannel ) {

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

					fs.writeFile("tester/IVCurves/" + time + ".itx", itx.getFile(), function( err ) {

						if( err ) {
							console.error("Can not save IV curve. Error was " + err.toString() );
						}

					} );
				}

			} else if( data2.indexOf("TRAC" ) > -1 ) {

				//fs.appendFileSync('run.txt', data2 + "\n" );
console.log( data2 );
				data2 = data2.split(',');	

				var deviceId = parseFloat( data2[ 1 ] );
			
				var voltage = Math.round( getVoltageFromCode( parseInt( data2[ 2 ] ), calibration ) * 1000000 )  / 1000000;
				var current = Math.round( getCurrentFromCode( parseInt( data2[ 3 ] ), calibration ) * 1000000 ) / 1000000;
				
				console.log( getVoltageFromCode( parseInt( data2[ 2 ] ), calibration ), getCurrentFromCode( parseInt( data2[ 3 ] ), calibration ) );	
				var vmin = Math.round( getVoltageFromCode( parseInt( data2[ 4 ] ), calibration ) * 1000000 ) / 1000000;
				var vmax = Math.round( getVoltageFromCode( parseInt( data2[ 5 ] ), calibration ) * 1000000 ) / 1000000;
				
				var cmin = Math.round( getCurrentFromCode( parseInt( data2[ 6 ] ), calibration ) * 1000000 ) / 1000000;
				var cmax = Math.round( getCurrentFromCode( parseInt( data2[ 7 ] ), calibration ) * 1000000 ) / 1000000;

				waveDate.push( ( Date.now() - date ) / 1000 );
				waveP.push( Math.round( current * voltage * 1000000 ) / 1000000 );
				waveC.push( current );
				waveV.push( voltage );
				
				waveVMin.push( vmin );
				waveVMax.push( vmax );

				waveCMin.push( cmin );
				waveCMax.push( cmax );
			}

			data = data.substr( data.indexOf(";") + 1);
		}	
	});


	setTimeout( function() {

		for( var i in commands ) {

			if( !isNaN( commands[ i ] ) && commands[ i ] !== undefined ) {

				console.log( i + ":CH" + channelId + " " + Number( "" + commands[ i ] ) + ";" );
				serial.write( i + ":CH" + channelId + " " + Number( "" + commands[ i ] ) + ";" );
				serial.drain();	
			}	
		}

	
	}, 3000 );
	


} );


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


function getVoltageFromCode( code, calibration ) {
	
	return code * calibration.DACSlope + calibration.DACOffset;
}


