
var serialport = require("serialport");
var Waveform = require("./lib/waveform");
var itxBuilder = require("./lib/itxbuilder");
var fs = require("fs");

var serial = new serialport.SerialPort( "/dev/cu.wchusbserial1410", {
	"baudrate": 57600,
    "dataBits": 8,  
    "parity": "none",
    "stopBits": 1
} );

var channelId = 3;

var calibration = { 
					"ADCSlopeVoltage":6.2495e-05,
					"ADCOffsetVoltage":-1.0252,
					"ADCSlopeCurrent":-6.2197e-7,
					"ADCOffsetCurrent":0.020361,
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
commands["MEASurement:REGUlation"] = 0.0001;

commands["CALIbration:DACOffset"] = calibration.DACOffset;
commands["CALIbration:DACSlope"] = calibration.DACSlope;
commands["CALIbration:CURRENT:ADCOffset"] = calibration.ADCOffsetCurrent;
commands["CALIbration:CURRENT:ADCSlope"] = calibration.ADCSlopeCurrent;

commands["CALIbration:VOLTAGE:ADCOffset"] = calibration.ADCOffsetVoltage;
commands["CALIbration:VOLTAGE:ADCSlope"] = calibration.ADCSlopeVoltage;


commands["MEASurement:MODE"] = 1;

var data = "";
var regu = 0.0001;
setTimeout( function() {

	setInterval( function() {
		console.log("UPDATE REGU");
		serial.write( "MEASurement:REGUlation:CH" + channelId + " " + regu + ";" );
		regu *= 2;
	}, 100000 );


}, 100000 );

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
			if( data2.indexOf( '<IV' ) > -1 ) {

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

			} else if( data2.indexOf("<TRAC" ) > -1 ) {

				//fs.appendFileSync('run.txt', data2 + "\n" );

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

		var keys = Object.keys( commands );

		function cmd( i ) {

			var key = keys[ i ];

			if( ! key ) {
				return;
			}

			if( !isNaN( commands[ key ] ) && commands[ key ] !== undefined ) {

			//	console.log( i + ":CH" + channelId + " " + Number( "" + commands[ i ] ) + ";" );
		//	console.log( key + ":CH" + channelId + " " + Number( "" + commands[ key ] ) + ";" );
		console.log(  key + ":CH" + channelId + " " + commands[ key ].noExponents() + ";" );
				serial.write( key + ":CH" + channelId + " " +  commands[ key ].noExponents() + ";", function( err, result ) {
					//console.log( err, result );
					serial.flush(function() {
setTimeout( function() {
							cmd( i + 1 );
}, 500 );
					});
				} );
				

				
			}

		}

		cmd( 0 );
	
	}, 3000 );


} );


function getCodeFromVoltage( voltage, calibration ) {
	return Math.round( ( voltage - calibration.ADCOffsetVoltage ) / calibration.ADCSlopeVoltage );
}

function getCodeFromDeltaVoltage( voltage, calibration ) {
	return Math.round( voltage / calibration.ADCSlopeVoltage );
}

function getCurrentFromCode( code, calibration ) {
	return code * calibration.ADCSlopeCurrent + calibration.ADCOffsetCurrent;
}

function getCodeFromCurrent( current, calibration ) {
	var code = ( current - calibration.ADCOffset ) / calibration.ADCSlope;	
	return parseInt( code );
}


function getVoltageFromCode( code, calibration ) {
	
	return code * calibration.ADCSlopeVoltage + calibration.ADCOffsetVoltage;
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


