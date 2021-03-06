
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

var channelId = 7;

var calibration = {
	"ADCSlopeCurrent":6.5952e-07,
	"ADCOffsetCurrent":-0.021511,
    "ADCSlopeVoltage":6.2638e-05,
    "ADCOffsetVoltage":-2.0514,
    "DACSlopeVoltage": 0.00099811,
    "DACOffsetVoltage":-2.0485,
    "channelId": 7, 
    "channelName":"Channel 7"
};



var commands = {};	
commands["MEASurement:TRACk:SENDrate"] = 0;
commands["MEASurement:TRACk:RATE"] = 0;
commands["MEASurement:IV:STARt"] = getCodeFromVoltage( 0.7, calibration );
commands["MEASurement:IV:STOP"] = getCodeFromVoltage( 0, calibration );
commands["MEASurement:IV:SCANrate"] = getCodeFromDeltaVoltage( 1, calibration );
commands["MEASurement:IV:NBPOints"] = 100;
commands["MEASurement:IV:DELAy"] = 1;
commands["MEASurement:REGUlation:POSItive"] = 0.001;
commands["MEASurement:REGUlation:NEGAtive"] = 0.001;
commands["MEASurement:REGulation:SWITchingtime:FORWard"] = 0;
commands["MEASurement:REGulation:SWITchingtime:BACKward"] = 0;

commands["CALIbration:DACOffset"] = calibration.DACOffsetVoltage;
commands["CALIbration:DACSlope"] = calibration.DACSlopeVoltage;
commands["CALIbration:CURRENT:ADCOffset"] = calibration.ADCOffsetCurrent;
commands["CALIbration:CURRENT:ADCSlope"] = calibration.ADCSlopeCurrent;
commands["NOISe:CURRent"] = 20;
commands["NOISe:VOLTage"] = 4;

commands["CALIbration:VOLTAGE:ADCOffset"] = calibration.ADCOffsetVoltage;
commands["CALIbration:VOLTAGE:ADCSlope"] = calibration.ADCSlopeVoltage;
commands["MEASurement:INCRement:CH7"] = 2;	


commands["MEASurement:TARGET:VOLTAGE"] = getCodeFromVoltage( 0.5, calibration );
console.log( getCodeFromVoltage( 0.5, calibration ) );

commands["MEASurement:MODE"] = 1;



var data = "";
var noiseCurrent = 20;

/*
setTimeout( function() {

	serial.write("MEASurement:IMMEdiate:CURRent:CH7;");

}, 20000 );
*/
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


	var itxFile = new itxBuilder.ITXBuilder();
	
	var date = Date.now();


var reguPositive = 0.00005;
var reguNegative = 0.0001;
var switchingTime = 1;

waveP = new Waveform();
waveC = new Waveform();
waveV = new Waveform();
var waveDate = new Waveform();


itxFile.newWave( "power" ).setWaveform( waveP );
itxFile.newWave( "current" ).setWaveform( waveC );
itxFile.newWave( "voltage" ).setWaveform( waveV );
itxFile.newWave( "time_ms" ).setWaveform( waveDate );



var lastChange = Date.now();

var positiveRegulations = [ 0.0000, 0.0001, 0.001, 0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07, 0.09, 0.11, 0.14 ];
var scanrates = [ [ 4, 0 ], [ 3, 0 ], [ 2, 0 ], [ 1, 0 ], [ 1, 40 ], [ 1, 60 ], [ 1, 80 ], [ 1, 100 ] ];


var switchingTimes = [ 0, 4, 16, 64, 256, 1024, 4096 ];

function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

var results = {};

var i = 0;

function change() {

/*	
	if( reguPositive < 0.1024 ) {
		reguPositive *= 2;
		serial.write( "MEASurement:REGUlation:POSItive:CH7 " + reguPositive + ";");	
	} else if( reguNegative < 0.1024 ) {
		reguPositive = 0.0001;
		reguNegative *= 2;
		serial.write( "MEASurement:REGUlation:NEGAtive:CH7 " + reguNegative + ";");	
	} else if( switchingTime < 2000 ) {
		reguPositive = 0.0001;
		reguNegative = 0.0001;
		switchingTime *= 2;
		serial.write( "MEASurement:REGUlation:SWITchingtime:CH7 " + reguNegative + ";");	
	}*/

	var posreguindex = randomIntFromInterval( 0, positiveRegulations.length - 1 );

	results[ posreguindex ] = results[ posreguindex ] || [];
	
	var j = 0;
	while( results[ posreguindex ].length == scanrates.length ) {
		
		posreguindex = randomIntFromInterval( 0, positiveRegulations.length - 1 );
		results[ posreguindex ] = results[ posreguindex ] || [];
		j++;
		if( j > 10000000 ) {
			console.log( error );

			return;
		}
	}

	var scanrateindex = randomIntFromInterval( 0, scanrates.length - 1 );

	while( results[ posreguindex ].indexOf( scanrateindex ) > -1 ) {

		scanrateindex = randomIntFromInterval( 0, scanrates.length - 1 );

	}
	

	results[ posreguindex ].push( scanrateindex );
	
	serial.write( "MEASurement:REGUlation:NEGAtive:CH7 " + positiveRegulations[ posreguindex ] + ";");	

	setTimeout( function() {
		serial.write( "MEASurement:INCRement:CH7 " + scanrates[ scanrateindex ][ 0 ] + ";");	

		setTimeout( function() {
			serial.write( "MEASurement:TRACKing:RATE:CH7 " + scanrates[ scanrateindex ][ 1 ] + ";");				
		}, 1000 );
	}, 1000 );


	console.log("MEASurement:REGUlation:POSItive:CH7 " + positiveRegulations[ posreguindex ] + ";");
	console.log("MEASurement:INCRement:CH7 " + scanrates[ scanrateindex ][ 0 ] + ";");
	console.log("MEASurement:TRACKing:RATE:CH7 " + scanrates[ scanrateindex ][ 1 ] + ";");

	waveP = new Waveform();
	waveC = new Waveform();
	waveV = new Waveform();
	waveDate = new Waveform();

	itxFile.newWave( "power_" + positiveRegulations[ posreguindex ] + "_" + scanrates[ scanrateindex ] ).setWaveform( waveP );
	itxFile.newWave( "current" + positiveRegulations[ posreguindex ] + "_" + scanrates[ scanrateindex ] ).setWaveform( waveC );
	itxFile.newWave( "voltage_" + positiveRegulations[ posreguindex ] + "_" + scanrates[ scanrateindex ] ).setWaveform( waveV );
	itxFile.newWave( "time_ms_" + positiveRegulations[ posreguindex ] + "_" + scanrates[ scanrateindex ] ).setWaveform( waveDate );

/*		
	itxFile.newWave( "power_" + reguPositive + "_" + reguNegative + "_" + switchingTime ).setWaveform( waveP );
	itxFile.newWave( "current" + reguPositive + "_" + reguNegative + "_" + switchingTime ).setWaveform( waveC );
	itxFile.newWave( "voltage_" + reguPositive + "_" + reguNegative + "_" + switchingTime ).setWaveform( waveV );
	itxFile.newWave( "time_ms_" + reguPositive + "_" + reguNegative + "_" + switchingTime ).setWaveform( waveDate );
*/

	lastChange = Date.now();
}



waveP = new Waveform();
waveC = new Waveform();
waveV = new Waveform();

current_code = new Waveform();
voltage_code = new Waveform();

itxFile.newWave( "current_code" ).setWaveform( current_code );
itxFile.newWave( "voltage_code" ).setWaveform( voltage_code );

var repetition = 60000;
var threshold = 40000;

var equilibrating = true;
/*
setTimeout( function() {

	setInterval( function() {
		change();	
	}, 120000);

	equilibrating = false;
	
}, 60000 );

*/
/*
	setTimeout( function() {

		serial.write( "NOISe:CURRent:CH7 40;");	
		setTimeout( function() {
			serial.write( "NOISe:VOLTage:CH7 3;");
		}, 100 );
		
		

		empt();
		
	}, 50000 );
*/
/*
	setTimeout( function() {

		serial.write( "NOISe:CURRent:CH7 0;");
		setTimeout( function() {
			serial.write( "NOISe:VOLTage:CH7 0;");
		}, 100 );
		
		setTimeout( function() {
			serial.write( "MEASurement:MODE:CH7 1;");
		}, 200 );
		
		
		

		empt();
		
	}, 100000 );


	setTimeout( function() {

		serial.write( "NOISe:CURRent:CH7 40;");
		setTimeout( function() {
			serial.write( "NOISe:VOLTage:CH7 3;");
		}, 100 );
		

		
		empt();
		
	}, 150000 );


*/
	function empt() {

		waveDate.push( ( Date.now() - date ) / 1000 );
		waveP.push( 0 );
		waveC.push( 0 );
		waveV.push( 0 );

		waveVMin.push( 0 );
		waveVMax.push( 0 );

		waveCMin.push( 0 );
		waveCMax.push( 0 );
	}

	setInterval( function() {

		fs.writeFileSync( "data_" + date + ".itx", itxFile.getFile() );

	}, 20000 );

	var recording = false;
	var iterator = 0;

	serial.on( "data", function( d ) {

		data = data || "";
		var data2;
		data += d.toString('ascii');

		while( data.indexOf(";") > -1 ) {


			data2 = data
				.substr( 0, data.indexOf(";") )
				.replace( ';', '' );


			data = data.substr( data.indexOf(";") + 1);

			if( data2.indexOf("<TRAC" ) > -1 ) {

//console.log( data2 );

			//	if( Date.now() - lastChange < threshold || equilibrating ) {
		//			continue;
	//			}


				//fs.appendFileSync('run.txt', data2 + "\n" );

				data2 = data2.split(',');	

				var voltage = Math.round( getVoltageFromCode( parseInt( data2[ 2 ] ), calibration ) * 1000000 ) / 1000000;
				var current = Math.round( getCurrentFromCode( parseInt( data2[ 3 ] ), calibration ) * 1000000 ) / 1000000;
				console.log( voltage, current );

				var deviceId = parseFloat( data2[ 1 ] );
			
				waveDate.push( ( Date.now() - lastChange ) / 1000 );
				waveP.push( Math.round( current * voltage * 1000000 ) / 1000000 );
				waveC.push( current );
				waveV.push( voltage );
			}

			
		}	


		if( (regResult = /MEASurement:IMMEdiate:CURRent:CH([0-9]+)\s([0-9]{1,6})/.exec( data2 ) ) ) {

			current_code.push( regResult[ 2 ] );
			serial.write( "MEASurement:IMMEdiate:VOLTage:CH" + channelId + ";" );	

		} else if ( (regResult = /MEASurement:IMMEdiate:VOLTage:CH([0-9]+)\s([0-9]{1,6})/.exec( data2 ) ) ) {

			iterator++;
			console.log( "Voltage code: " + regResult[ 2 ] );

			voltage_code.push( regResult[ 2 ] );

			if( iterator >= 100000 ) {
				
				iterator = 0;


			} else {

				serial.write( "MEASurement:IMMEdiate:CURRent:CH" + channelId + ";" );	
			}

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


