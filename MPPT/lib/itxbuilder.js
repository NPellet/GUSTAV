
//var Waveform = require('../waveform');
var exports = {};


var IgorFile = function() {

	this.waves = {};
	this.beginFile = "IGOR\n";
	this.endFile = "";
}

IgorFile.prototype = {

	newWave: function( name ) {

		if( name instanceof IgorWave ) {

			var w = name;
			if( this.waves[ w.getName( ) ] ) {
				throw "A wave with a similar name already exists";
			}

			return this.waves[ w.getName( ) ] = w;
		}

		if( this.waves[ name ] ) {
			throw "A wave with a similar name already exists";
		}

		if( ! name ) {
			throw "Wave name must not be empty";
		}

		return this.waves[ name ] = new IgorWave( name );
	},

	getFile: function( filename ) {

		var string = "";
		string += this.beginFile;

		for( var i in this.waves ) {
			string += this.waves[ i ].getText( );
		}

		string += this.endFile;
		return string;
	}
};

var IgorWave = function( name ) {

	if( ! name ) {
		throw "Wave name must not be empty";
	}

	this.name = name;
}

IgorWave.prototype = {

	setWaveform: function( w ) {

	/*	if( ! ( w instanceof Waveform ) ) {
			var w2 = new Waveform();
			w2.setData( w );
			w = w2;
		}*/
		this.waveform = w;
	},

	getText: function() {

		if( ! this.waveform ) {
			throw "No assigned waveform";
		}

		var string = "";
		string += "WAVES/D	'" + this.name + "'";

		if( this.waveform.hasXScaling() && this.waveform.getXScalingMode() == 'wave') {
			string += " '" + this.name + "_x'";
		}
		string += "\n";
		string += "BEGIN\n";


		if( this.waveform.hasXScaling() && this.waveform.getXScalingMode() == 'wave') {

				var data = this.waveform.getData();
				var dataX = this.waveform.getXWave().getData();

				for( var i = 0, l = data.length; i < l ; i ++ ) {
					string += data[ i ] + " " + dataX[ i ] + "\n";
				}

		} else {

			string += this.waveform.getData().join("\n");
			string += "\n";
		}


		string += "END\n";

		// If we have scaling or x axis unit
		if(  ( this.waveform.hasXScaling() && this.waveform.getXScalingMode() == 'delta' ) || this.waveform.hasXUnit() ) {

			// Then we call the setscale
			var stringScaling = "x SetScale/";

			// If we have actually scaling, let's parse it
			if(   ( this.waveform.hasXScaling() && this.waveform.getXScalingMode() == 'delta' ) ) {

				switch( this.waveform.getXScalingMode( ) ) {

					case 'delta':
						stringScaling += "P x " + this.waveform.getXScaling().x0 + "," + this.waveform.getXScaling().xDelta;
					break;


				}
			// In case of no scaling, default is delta mode with x0 = 0, xDelta = 1
			} else {
				stringScaling += "P 0, 1";
			}

			// Adding the x axis unit
			stringScaling += ", \"" + ( this.waveform.getXUnit( ) || "" ) + "\"";
			stringScaling += ", '" + this.name + "'";
			stringScaling += "\n";

			string += stringScaling
		}

		if( this.waveform.hasYUnit( ) ) {
			string += "x SetScale y 0, 0,\"" + ( this.waveform.getYUnit( ) || "" ) + "\", '" + this.name + "'\n";
		}

		return string;
	},

	getName: function() {
		return this.name;
	}
}

exports.ITXBuilder = IgorFile;
exports.ITXWave = IgorWave;

module.exports = exports;
