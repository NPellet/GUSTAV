
var extend = require('extend');

var Waveform = function() {
	this.data = [];

	this.xScaling = {
		type: 'delta',
		x0: 0,
		xDelta: 1
	};
};

Waveform.prototype = {

	setData: function( data ) {

		if( ! data ) {
			return;
		}

		this.data = data;
		this.length = this.data.length;

		this._checkScalingWave();
		return this;
	},

	setDataFromArray: function( a, index, startAt ) {
		var a2 = [];
		startAt = startAt || 0;
		for( var i = startAt, l = a.length; i < l ; i ++ ) {
			a2.push( a[ i ][ index ] );
		}

		this.data = a2;
		this.length = this.data.length;

		this._checkScalingWave();
		return this;
	},

	get: function( index ) {
		return this.data[ index ];
	},

	set: function( index, value ) {
		this.data[ index ] = value;
	},

	getMax: function() {
		return Math.max.apply( null, this.data )
	},

	getMin: function() {
		return Math.min.apply( null, this.data )
	},

	getXMax: function( interpolate ) {

		var max = - Infinity;
		var maxX = false;

		for( var i = 0; i < this.data.length; i ++ ) {
				if( this.data[ i ] > max ) {
					max = this.data[ i ];
					maxX = i;
				}
		}

		if( ! interpolate ) {
			return maxX;
		} else {
			var xWave = this.getXWave();
			var interpolation = interpolate( xWave.get( maxX - 1 ), xWave.get( maxX ), xWave.get( maxX + 1 ), this.get( maxX - 1 ), this.get( maxX ), this.get( maxX + 1 ) );
			return - interpolation[ 1 ] / ( 2 * interpolation[ 0 ] );
		}
	},

	getXMin: function( interpolate ) {

		var min = - Infinity;
		var minX = false;

		for( var i = 0; i < this.data.length; i ++ ) {
				if( this.data[ i ] < min ) {
					min = this.data[ i ];
					minX = i;
				}
		}

		if( ! interpolate ) {
			return minX;
		} else {
			var xWave = this.getXWave();
			var interpolation = interpolate( xWave.get( minX - 1 ), xWave.get( minX ), xWave.get( minX + 1 ), this.get( minX - 1 ), this.get( minX ), this.get( minX + 1 ) );
			return - interpolation[ 1 ] / ( 2 * interpolation[ 0 ] );
		}
	},

	push: function( value, valueX ) {

		if( Array.isArray( value ) ) {

			this.data = this.data.concat( value );

		} else if( value instanceof Waveform || valueX !== undefined ) { // This has to kill the x delta scaling

			switch( this.getXScalingMode() ) {

				case 'delta':

				this.xScaling = {
					type: 'wave',
					wave: this.getXWave()
				};

				break;

				case 'wave': // This is fine, no need to destroy it
				break;
			}

			if( value instanceof Waveform ) {
				this.data = this.data.concat( value.getData( ) );

				if( this.xScaling ) {
					this.xScaling.wave.push( value.getXWave().getData() );
				}
			} else {
				this.data.push( value );
				this.xScaling.wave.push( valueX );
			}

		} else {

			this.data.push( value );

		}
	},

	sortX: function() {
		Waveform.sort( this.getXWave(), [ this.getXWave(), this ] );
	},


	setXUnit: function( xUnit ) {
		this.xUnit = xUnit;
	},

	setYUnit: function( yUnit ) {
		this.yUnit = yUnit;
	},

	setXScaling: function( x0, xDelta ) {
		this.xScaling = {
			type: 'delta',
			x0: x0,
			xDelta: xDelta
		};
	},

	duplicate: function() {
		var w = new Waveform();
		w.setData(this.data.slice(0) );
		w.xScaling = extend({}, this.xScaling );
		w.yUnit = this.yUnit;
		w.xUnit = this.xUnit;
		return w;
	},

	setXWave: function( w ) {

		if( ! w ) {
			w = new Waveform();
		}

		if( ! ( w instanceof Waveform ) ) {

			if( Array.isArray( w ) ) {

				var wave = new Waveform();
				wave.setData( w );
				w = wave;
			} else {

				throw "X wave must be a waveform"
			}
		}

		this.xScaling = {
			type: 'wave',
			wave: w
		}
	},

	_checkScalingWave: function() {

		if( ! this.hasXScaling() || ! ( this.xScaling.mode == "wave" ) ) {
			return;
		}

		if( this.length != this.xScaling.wave.length ) {
			this.warn("Mismatch in x wave dimension.");
		}
	},

	hasXScaling: function() {
		return ! ! this.xScaling;
	},

	hasXUnit: function() {
		return ! ! this.xUnit;
	},

	hasYUnit: function() {
		return ! ! this.yUnit;
	},

	getXUnit: function() {
		return this.xUnit;
	},

	getYUnit: function() {
		return this.yUnit;
	},

	getXScaling: function() {
		return this.xScaling;
	},

	getXScalingMode: function() {
		return this.xScaling ? this.xScaling.type : false
	},

	getData: function() {
		return this.data;
	},

	getDataLength: function() {
		return this.data.length;
	},

	searchBinary: function( val, interpolate ) {

		var k1 = 0,
		k2 = this.data.length - 1,
		kint,
		asc = this.data[ k1 ] < val;

		if( this.hasXScaling() && this.xScaling.type !== 'delta' ) {
			this.error("Cannot perform binary search on a non linearly increasing x axis");
		}

		// Problem, the two boundaries are on the same side.
		if( ( this.data[ k1 ] > val && this.data[ k2 ] > val ) || ( this.data[ k1 ] < val && this.data[ k2 ] < val ) ) {
			throw "Binary search cannot be performed as the needle is out of range."
			return false;
		}

		while( true ) {

			kint = Math.ceil( ( k2 + k1 ) / 2 );

			if( kint == k2 || kint == k1 && k2 - k1 > 1 ) {
				throw "Error in binary search";
			}

			// kint is the new k1
			if( ( this.data[ kint ] < val && asc ) || ( this.data[ kint ] > val && ! asc ) ) {
				k1 = kint
			} else {
				k2 = kint;
			}

			// Converged
			if( k2 - k1 == 1 ) {

				var d = val - this.data[ k2 ] / ( this.data[ k1 ] - this.data[ k2 ] );
				if( ! interpolate ) {

					if( d < 0.5 ) {
						return k1;
					} else {
						return k2;
					}
				} else {
					return k2 + ( d * ( k1 - k2 ) );
				}
			}
		}
	},

	getValueAt: function( p ) {

		if( this.data.length - 1 < p ) {
			console.trace();
			throw "Cannot access index " + p + ". Index is out of range";
		}

		if( p != Math.round( p ) ) {
			var prev = this.data[ Math.floor( p ) ];
			var next = this.data[ Math.ceil( p ) ];

			return prev * ( p - Math.round( p ) ) + next * ( Math.ceil( p ) - p )
		}

		return this.data[ p ];
	},

	getIndexFromX: function( x ) {

		switch( this.getXScalingMode() ) {

			case 'delta':
			return Math.round( ( x - this.xScaling.x0 ) / ( this.xScaling.xDelta ) );
			break;

			case 'wave':
			return this.xScaling.wave.searchBinary( x );
			break;
		}
	},

	getXFromIndex: function( p ) {

		switch( this.getXScalingMode() ) {

			case 'delta':
			return ( p * this.xScaling.xDelta + this.xScaling.x0 );
			break;

			case 'wave':
			return this.xScaling.wave.getValueAt( p );
			break;
		}
	},

	getXDeltaBetween: function( p1, p2 ) {

		switch( this.getXScalingMode() ) {

			case 'delta':
			if( p1 >= 0 && p2 >= 0 && p1 < this.data.length && p2 < this.data.length ) {
				return this.getXFromIndex( p1 ) - this.getXFromIndex( p2 );
			}

			return false;
			break;


			case 'wave':

			return this.xScaling.wave.getXFromIndex( p1 ) - this.xScaling.wave.getXFromIndex( p2 );
			break;
		}
	},

	getAverageP: function( from, to ) {

		var sum = this._integrateP( from, to );

		return sum[ 0 ] / sum[ 2 ];
	},

	getAverageX: function( from, to ) {

		var sum = this._integrateX( from, to );
		return sum[ 0 ] / sum[ 2 ];
	},

	subset: function( p0, p1 ) {
		var w = new Waveform();
		p0 = Math.round( p0 );
		p1 = Math.round( p1 );
		for( var i = p0; i <= p1; i+= 1 ) {
			w.push( this.data[ i ] );
		}

		switch( this.getXScalingMode() ) {

			case 'delta':
			var start = this.getXFromIndex( p0 );
			w.setXScaling( start, this.xScaling.xDelta );
			break;

			case 'wave':
			w.setXWave( this.xScaling.wave.subset( p0, p1 ) );
			break;
		}

		w.setXUnit( this.getXUnit() );
		w.setYUnit( this.getYUnit() );

		return w;
	},

	getXWave: function() {

		switch( this.getXScalingMode() ) {

			case 'delta':
			var w = new Waveform();
			for( var i = 0; i < this.getDataLength(); i += 1 ) {
				w.push( this.xScaling.x0 + i * this.xScaling.xDelta );
			}
			return w;
			break;

			case 'wave':
			return this.xScaling.wave;
			break;
		}
	},

	shiftX: function( shift ) {


		switch( this.getXScalingMode() ) {

			case 'delta':
			this.xScaling.x0 += shift;
			break;

			case 'wave':
			this.xScaling.wave.add( shift );
			break;
		}
	},

	shiftXToMin: function( target ) {

		switch( this.getXScalingMode() ) {

			case 'delta':
			var t = this.xScaling.x0 - target;
			break;

			case 'wave':
			var t = this.xScaling.wave.get( 0 ) - target;
			break;
		}

		this.shiftX( - t );
	},

	average: function( p0, p1 ) {
		if( p0 == undefined ) {
			p0 = 0;
		}

		if( p1 == undefined ) {
			p1 = this.getDataLength() - 1;
		}

		return this.getAverageP( p0, p1 );
	},

	mean: function() {
		return this.average();
	},

	median: function() {
		var dupl = this.data.slice( 0 );
		dupl.sort();

		return dupl[ Math.ceil( dupl.length / 2 ) - 1 ];
	},

	stdDev: function() {
		var i = 0, l = this.data.length;
		var mean = this.mean();
		var sdev = 0;

		for( ; i < l ; i ++ ) {
			sdev += Math.pow( ( this.data[ i ] - mean ), 2 );
		}

		sdev /= l;

		return Math.pow( sdev, 0.5 );
	},

	subtract: function( val ) {

		if( typeof val == "function" ) {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] -= val( this.getXFromIndex( i ), this.data[ i ] );
			}

		}	else if( val instanceof Waveform ) {

			if( val.getDataLength() == this.getDataLength() ) {

				for( var i = 0; i < this.data.length; i ++ ) {
					this.data[ i ] -= val.get( i );
				}

			} else {
				throw "Cannot subtract two waves with unequal number of points";
			}

		} else {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] -= val;
			}
		}
	},


	add: function( val ) {


		if( typeof val == "function" ) {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] += val( this.getXFromIndex( i ), this.data[ i ] );
			}

		}	else if( val instanceof Waveform ) {

			if( val.getDataLength() == this.getDataLength() ) {

				for( var i = 0; i < this.data.length; i ++ ) {
					this.data[ i ] += val.get( i );
				}

			} else {
				throw "Cannot subtract two waves with unequal number of points";
			}

		} else {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] += val;
			}
		}
	},


	_integrateX: function( xFrom, xTo ) {

		var from, to;

		if( from == undefined ) {
			from = 0;
		} else {
			from = this.getIndexFromX( xFrom );
		}

		if( to == undefined ) {
			to = this.data.length;
		} else {
			to = this.getIndexFromX( xTo );
		}

		return this._integrateP( from, to );
	},

	_integrateP: function( from, to ) {

		if( ! from && ! to ) {
			from = 0;
			to = this.getDataLength() - 1;
		}

		from = Math.round( from );
		to = Math.round( to );
		var l = to - from + 1;
		var sum = 0, delta;

		if( this.hasXScaling() ) {

			var deltaTot = this.getXDeltaBetween( to, from - 1 );
			// Temporary fix

			if( this.getXScalingMode() == 'delta' ) {

				deltaTot = this.xScaling.xDelta * l;

				for( ; from <= to ; from ++ ) {

					delta = this.xScaling.xDelta;//this.getXDeltaBetween( from, from - 1 );

					if( delta !== false ) {
						sum += this.data[ from ] * delta;
					}
				}

			} else {

				deltaTot = 0;
				var xWave = this.getXWave().getData();
				for( ; from <= to ; from ++ ) {

					if( xWave.length - 1 > from ) {

						deltaTot += xWave[ from + 1 ] - xWave[ from ]
						sum += this.data[ from ] * ( xWave[ from + 1] - xWave[ from ] );
					}
				}
			}
		} else {

			var deltaTot = this.data.length;

			for( ; from <= to ; from ++ ) {

				sum += this.data[ from ];
			}


		}

		return [ sum, l, deltaTot ];
	},

	integrateX: function( from, to ) {
		var val = this._integrate( from, to );
		return val[ 0 ];
	},

	integrateP: function( from, to ) {
		var val = this._integrateP( from, to );
		return val[ 0 ];
	},

	integrateToWave: function() {

		var w = this.duplicate();

		var from = 0, to = this.data.length;

		for( ; from <= to ; from ++ ) {

			delta = this.getXDeltaBetween( from, from - 1 );

			if( delta !== false ) {
				sum += this.data[ from ] * delta;
				this.set( from, sum );
			} else {
				throw "Integration error"
			}
		}

		return w;
	},

	divideBy: function( val ) {

		if( typeof val == "function" ) {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] /= val( this.getXFromIndex( i ), this.data[ i ] );

			}
		} else if( val instanceof Waveform ) {

			if( val.getDataLength() == this.getDataLength() ) {

				for( var i = 0; i < this.data.length; i ++ ) {
					this.data[ i ] /= val.get( i );
				}

			} else {
				throw "Cannot divide two waves with unequal number of points";
			}

		} else {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] /= val;
			}
		}

		return this;
	},

	multiplyBy: function( val ) {


		if( typeof val == "function" ) {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] *= val( this.getXFromIndex( i ), this.data[ i ] );

			}
		} else if( val instanceof Waveform ) {

			if( val.getDataLength() == this.getDataLength() ) {

				for( var i = 0; i < this.data.length; i ++ ) {
					this.data[ i ] *= val.get( i );
				}

			} else {
				throw "Cannot multiply two waves with unequal number of points";
			}

		} else {

			for( var i = 0; i < this.data.length; i ++ ) {

				this.data[ i ] *= val;
			}
		}

		return this;
	},


	divide: function() {
		return this.divideBy.apply( this, arguments )
	},

	multiply: function() {
		return this.multiplyBy.apply( this, arguments );
	},

	findLevels: function( level, options ) {

			options = extend( {

				box: 1,
				edge: 'ascending',
				rounding: 'before',
				rangeP: [ 0, this.data.length ],

			}, options );

			var lastLvlIndex = options.rangeP[ 0 ];
			var lvlIndex;
			var indices = [];

			while( lvlIndex = this.findLevel( level, extend( true, {}, options, { rangeP: [ lastLvlIndex, options.rangeP[ 1 ] ] } ) ) ) {
					indices.push( lvlIndex );
					lastLvlIndex = Math.ceil( lvlIndex );
			}

			return indices;
	},


	// Find the first level in the specified range
	findLevel: function( level, options ) {

		options = extend( {

			box: 1,
			edge: 'ascending',
			direction: 'ascending',
			rounding: 'before',
			rangeP: [ 0, this.data.length ],

		}, options );

		if( options.rangeX ) {
			options.rangeP = options.rangeX.map( this.getIndexFromX );
		}

		var value,
		below;

		var box = options.box;

		if( box % 2 == 0 ) {
			box ++;
		}

		if( options.direction == "descending" ) {
			var i = options.rangeP[ 1 ],
				l = options.rangeP[ 0 ],
				increment = -1;
		} else {
			var i = options.rangeP[ 0 ],
				l = options.rangeP[ 1 ],
				increment = +1;
		}

		for(; ; i += increment ) {

			if( options.direction == "descending" ) {
				if( i < l ) {
					break;
				}
			} else {
				if( i > l ) {
					break;
				}
			}

			if( i < options.rangeP[ 0 ] + ( box - 1 ) / 2 ) {
				continue;
			}

			if( i > options.rangeP[ 1 ] - ( box - 1 ) / 2 ) {
				break;
			}

			value = this.getAverageP( i - ( box - 1 ) / 2 , i + ( box - 1 ) / 2 );

			if( below === undefined ) {
				below = value < level;
				continue;
			}
			// Crossing up
			if( value > level && below ) {

				below = false;

				if( options.edge == 'ascending' ) {
					// Found something
					for( j = i + ( box - 1 ) / 2 ; j >= i - ( box - 1 ) / 2 ; j -- ) {

						if( this.data[ j ] > level && this.data[ j - 1 ] < level ) { // Find a crossing

							switch( options.rounding ) {
									case 'before':
											return j - 1;
									break;

									case 'after':
											return j;
									break;

									case 'interpolate':
										return getIndexInterpolate( level, this.data[ j ], this.data[ j - 1 ], j, j - 1 );
									break;
							}						}
					}
				}

			} else if( value < level && ! below ) {

				below = true;

				if( options.edge == 'descending' ) {

					for( j = i + ( box - 1 ) / 2 ; j >= i - ( box - 1 ) / 2 ; j -- ) {
						if( this.data[ j ] < level && this.data[ j - 1 ] > level ) { // Find a crossing

							switch( options.rounding ) {
									case 'before':
											return j - 1;
									break;

									case 'after':
											return j;
									break;

									case 'interpolate':
										return getIndexInterpolate( level, this.data[ j ], this.data[ j - 1 ], j, j - 1 );
									break;
							}

						}
					}
				}
			}
		}
	},

	degradeExp: function( nbPoints, stepAvg ) {

		var d = this.getData();
		var x = this.getXWave().getData();
		var dl = this.getDataLength();
		var e = 2.71828;
		var y0 = -1,
		b = Math.log( dl ) / ( nbPoints - 1 ),
		index,
		dFinal = [],
		xFinal = [];

		function getIndex( i ) {
			return Math.floor( -1 + Math.pow( e, ( b * i ) ) );
		}

		for( var i = 0; i < nbPoints; i ++ ) {

			index = getIndex( i );

			if( i > 0 ) {
				var nextIndex = getIndex( i - 1 );
				var diff = Math.floor( ( index - nextIndex ) * stepAvg );
				diff = Math.min( 1000, diff );

				var sumX = 0;
				var sum = 0;
				var k = 0;

				for( var j = index - diff; j <= index; j ++ ) {

					sum += d[ index ];
					sumX += x[ index ];
					k ++;
				}

				dFinal.push( sum / k );
				xFinal.push( sumX / k );

			} else {

				dFinal.push( d[ index ] );
				xFinal.push( x[ index ] );
			}
		}

		var w = new Waveform();
		w.setData( dFinal );
		w.setXWave( xFinal );

		return w;
	},

	degrade: function( nbPoints ) {

		var d = this.getData();
		var x = this.getXWave().getData();
		var dl = this.getDataLength();

		var		index,
		dFinal = [],
		xFinal = [],
		step = Math.floor( dl / nbPoints );


		for( var i = 0; i < dl; i += step ) {

			dFinal.push( d[ i ] );
			xFinal.push( x[ i ] );
		}

		var w = new Waveform();
		w.setData( dFinal );
		w.setXWave( xFinal );
		return w;
	},

	loess: function( bandwidth, robustness, accuracy ) {

// https://github.com/jasondavies/science.js/blob/master/science.v1.js
// Based on org.apache.commons.math.analysis.interpolation.LoessInterpolator
// from http://commons.apache.org/math/

		function science_stats_loessFiniteReal(values) {
			var n = values.length,
			i = -1;

			while (++i < n) if (!isFinite(values[i])) return false;

			return true;
		}

		function science_stats_loessStrictlyIncreasing(xval) {
			var n = xval.length,
			i = 0;

			while (++i < n) if (xval[i - 1] >= xval[i]) return false;

			return true;
		}

		// Compute the tricube weight function.
		// http://en.wikipedia.org/wiki/Local_regression#Weight_function
		function science_stats_loessTricube(x) {
			return (x = 1 - x * x * x) * x * x;
		}

		// Given an index interval into xval that embraces a certain number of
		// points closest to xval[i-1], update the interval so that it embraces
		// the same number of points closest to xval[i], ignoring zero weights.
		function science_stats_loessUpdateBandwidthInterval( xval, weights, i, bandwidthInterval) {

			var left = bandwidthInterval[0],
			right = bandwidthInterval[1];

		  // The right edge should be adjusted if the next point to the right
		  // is closer to xval[i] than the leftmost point of the current interval
		  var nextRight = science_stats_loessNextNonzero(weights, right);
		  if ((nextRight < xval.length) && (xval[nextRight] - xval[i]) < (xval[i] - xval[left])) {
		  	var nextLeft = science_stats_loessNextNonzero(weights, left);
		  	bandwidthInterval[0] = nextLeft;
		  	bandwidthInterval[1] = nextRight;
		  }
		}

		function science_stats_loessNextNonzero(weights, i) {
			var j = i + 1;
			while (j < weights.length && weights[j] === 0) j++;
			return j;
		}


		var bandwidth = bandwidth || 0.3,
		robustnessIters = robustness || 1,
		accuracy = accuracy || 1e-12;

		var xval = this.getXWave().getData();
		var yval = this.getData();
		var weights = undefined;


		var n = xval.length,
		i;

		if (n !== yval.length) throw {error: "Mismatched array lengths"};
		if (n == 0) throw {error: "At least one point required."};

		if (! weights) {
			weights = [];
			i = -1; while (++i < n) weights[i] = 1;
		}

		science_stats_loessFiniteReal(xval);
		science_stats_loessFiniteReal(yval);
		science_stats_loessFiniteReal(weights);
		science_stats_loessStrictlyIncreasing(xval);

		if (n == 1) return [yval[0]];
		if (n == 2) return [yval[0], yval[1]];

		var bandwidthInPoints = Math.floor(bandwidth * n);

		if (bandwidthInPoints < 2) throw {error: "Bandwidth too small."};

		var res = [],
		residuals = [],
		robustnessWeights = [];

	    // Do an initial fit and 'robustnessIters' robustness iterations.
	    // This is equivalent to doing 'robustnessIters+1' robustness iterations
	    // starting with all robustness weights set to 1.
	    i = -1; while (++i < n) {
	    	res[i] = 0;
	    	residuals[i] = 0;
	    	robustnessWeights[i] = 1;
	    }

	    var iter = -1;
	    while (++iter <= robustnessIters) {
	    	var bandwidthInterval = [0, bandwidthInPoints - 1];
	      // At each x, compute a local weighted linear regression
	      var x;
	      i = -1; while (++i < n) {
	      	x = xval[i];

	        // Find out the interval of source points on which
	        // a regression is to be made.
	        if (i > 0) {
	        	science_stats_loessUpdateBandwidthInterval(xval, weights, i, bandwidthInterval);
	        }

	        var ileft = bandwidthInterval[0],
	        iright = bandwidthInterval[1];

	        // Compute the point of the bandwidth interval that is
	        // farthest from x
	        var edge = (xval[i] - xval[ileft]) > (xval[iright] - xval[i]) ? ileft : iright;

	        // Compute a least-squares linear fit weighted by
	        // the product of robustness weights and the tricube
	        // weight function.
	        // See http://en.wikipedia.org/wiki/Linear_regression
	        // (section "Univariate linear case")
	        // and http://en.wikipedia.org/wiki/Weighted_least_squares
	        // (section "Weighted least squares")
	        var sumWeights = 0,
	        sumX = 0,
	        sumXSquared = 0,
	        sumY = 0,
	        sumXY = 0,
	        denom = Math.abs(1 / (xval[edge] - x));

	        for (var k = ileft; k <= iright; ++k) {
	        	var xk   = xval[k],
	        	yk   = yval[k],
	        	dist = k < i ? x - xk : xk - x,
	        	w    = science_stats_loessTricube(dist * denom) * robustnessWeights[k] * weights[k],
	        	xkw  = xk * w;
	        	sumWeights += w;
	        	sumX += xkw;
	        	sumXSquared += xk * xkw;
	        	sumY += yk * w;
	        	sumXY += yk * xkw;
	        }

	        var meanX = sumX / sumWeights,
	        meanY = sumY / sumWeights,
	        meanXY = sumXY / sumWeights,
	        meanXSquared = sumXSquared / sumWeights;

	        var beta = (Math.sqrt(Math.abs(meanXSquared - meanX * meanX)) < accuracy)
	        ? 0 : ((meanXY - meanX * meanY) / (meanXSquared - meanX * meanX));

	        var alpha = meanY - beta * meanX;

	        res[i] = beta * x + alpha;
	        residuals[i] = Math.abs(yval[i] - res[i]);
	    }

	      // No need to recompute the robustness weights at the last
	      // iteration, they won't be needed anymore
	      if (iter === robustnessIters) {
	      	break;
	      }

	      // Recompute the robustness weights.

	      // Find the median residual.
	      var sortedResiduals = residuals.slice();
	      sortedResiduals.sort();
	      var medianResidual = sortedResiduals[Math.floor(n / 2)];

	      if (Math.abs(medianResidual) < accuracy)
	      	break;

	      var arg,
	      w;
	      i = -1; while (++i < n) {
	      	arg = residuals[i] / (6 * medianResidual);
	      	robustnessWeights[i] = (arg >= 1) ? 0 : ((w = 1 - arg * arg) * w);
	      }
	  }


	  w2 = this.duplicate();
	  w2.setData( res );
	  return w2;
	},

	math: function( fct ) {

		var i = 0;

		this.data = this.data.map( function() {

			i++;
			return fct( this.get( i ), this.getXFromIndex( i - 1 ) );

		} );
	}
}

Waveform.sort = function( keyWave, wavesToSort ) {

	var dataKey = keyWave.getData().slice( 0 );

	var global = [],
	arrZipped

	for( var i = 0; i < dataKey.length; i ++ ) {
		arrZipped = [ dataKey[ i ] ];

		for( var j = 0; j < wavesToSort.length; j ++ ) {
			arrZipped.push( wavesToSort[ j ].get( i ) );
		}
		global.push( arrZipped );
	}

	global.sort( function( a, b ) {
		return a[ 0 ] - b[ 0 ];
	});


	for( var i = 0; i < dataKey.length; i ++ ) {

		for( var j = 0; j < wavesToSort.length; j ++ ) {

			wavesToSort[ j ].set( i, global[ i ][ j + 1 ] );
		}
	}
}

Waveform.average = function( ) {

	var w1 = arguments[ 0 ];
	for( var i = 1, l = arguments.length; i < l; i ++ ) {
		w1.add( arguments[ i ] );
	}

	w1.divideBy( arguments.length );

	return w1;
}

function getIndexInterpolate( value, valueBefore, valueAfter, indexBefore, indexAfter ) {
		return ( value - valueBefore ) / ( valueAfter - valueBefore ) * ( indexAfter - indexBefore ) + indexBefore;
}


function interpolate( x1, x2, x3, y1, y2, y3 ) {
	var x12 = x1 * x2;
	var x22 = x2 * x2;
	var x32 = x3 * x3;

	var a = ( y1 - y2 - ( ( y1 - y3 ) / ( x1 - x3 ) ) * ( x1 - x2 ) )  / (  ( x12 - x22 )  -  (x12 - x32)  * ( x1 - x2 ) / ( x1 - x3 ) )
	var b = ( y1 - y3 - a * ( x12 - x32 ) ) / ( x1 - x3 );
	var c = y3 - a * x32 - b * x3;

	return [ a, b, c ];
}

	module.exports = Waveform;
