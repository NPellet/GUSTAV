var lockRedraw;
var period;
var graphs;

var socket,
	maxTime = 0,
	timeout;

	var data = {};
/*
function makeSocket() {


	socket = new WebSocket("ws://128.179.167.239:8080");


	 socket.onopen = function() {
	 	
	     socket.send( JSON.stringify( { command: "getAll" } ) );
	 };

	 socket.onmessage = function(e) {

	 	var d = JSON.parse( e.data );

	 	if( ! d.latest ) {
	 		d.latest = {};
	 	}


	 	for( var i = 0, l = d.data.length; i < l; i ++ ) {

	 		if( d.data[ i ].data.currents.length > 0 ) {

	 			data[ d.data[ i ].deviceId ] = data[ d.data[ i ].deviceId ] || {};

	 			data[ d.data[ i ].deviceId ].currents = data[ d.data[ i ].deviceId ].currents || [];
	 			data[ d.data[ i ].deviceId ].voltages = data[ d.data[ i ].deviceId ].voltages || [];
	 			data[ d.data[ i ].deviceId ].powers = data[ d.data[ i ].deviceId ].powers || [];

	 			data[ d.data[ i ].deviceId ].currentsminmax = data[ d.data[ i ].deviceId ].currentsminmax || [];
	 			data[ d.data[ i ].deviceId ].voltagesminmax = data[ d.data[ i ].deviceId ].voltagesminmax || [];
	 			data[ d.data[ i ].deviceId ].powersminmax = data[ d.data[ i ].deviceId ].powersminmax || [];

	 			data[ d.data[ i ].deviceId ].currents = data[ d.data[ i ].deviceId ].currents.concat( d.data[ i ].data.currents );
	 			data[ d.data[ i ].deviceId ].voltages = data[ d.data[ i ].deviceId ].voltages.concat( d.data[ i ].data.voltages );
	 			data[ d.data[ i ].deviceId ].powers = data[ d.data[ i ].deviceId ].powers.concat( d.data[ i ].data.powers );

	 			data[ d.data[ i ].deviceId ].currentsminmax = data[ d.data[ i ].deviceId ].currentsminmax.concat( d.data[ i ].data.currentsminmax );
	 			data[ d.data[ i ].deviceId ].voltagesminmax = data[ d.data[ i ].deviceId ].voltagesminmax.concat( d.data[ i ].data.voltagesminmax );
	 			data[ d.data[ i ].deviceId ].powersminmax = data[ d.data[ i ].deviceId ].powersminmax.concat( d.data[ i ].data.powersminmax );



				graphC.getSerie( "serie_" + d.data[ i ].deviceId + "" ).setData( data[ d.data[ i ].deviceId ].currents );
				graphV.getSerie( "serie_" + d.data[ i ].deviceId + "" ).setData( data[ d.data[ i ].deviceId ].voltages );
				graphP.getSerie( "serie_" + d.data[ i ].deviceId + "" ).setData( data[ d.data[ i ].deviceId ].powers );
		
				graphC.getSerie( "serie_" + d.data[ i ].deviceId + "_zone" ).setData( data[ d.data[ i ].deviceId ].currentsminmax );
				graphV.getSerie( "serie_" + d.data[ i ].deviceId + "_zone" ).setData( data[ d.data[ i ].deviceId ].voltagesminmax );
				graphP.getSerie( "serie_" + d.data[ i ].deviceId + "_zone" ).setData( data[ d.data[ i ].deviceId ].powersminmax );
		
				maxTime = Math.max( data[ d.data[ i ].deviceId ].powers[ data[ d.data[ i ].deviceId ].powers.length - 1 ][ 0 ], maxTime );
			}
		}


		if( ! lockRedraw ) {

			recalculateAxisSpan();

		}

		if( ! timeout ) {

			timeout = setTimeout( function() {

				socket.send( JSON.stringify( { command: "getLatest", latest: d.latest } ) );
				timeout = false;

			}, 200 );
		}	
	 };

	 socket.onclose = function() {
	     console.log('close');
	 };
};*/

var cSerie, vSerie, pSerie;
var graphC, graphV, graphP;

var currentChannel;

$.fn.serializeObject = function()
{
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};


setInterval( function() {

	recalculateAxisSpan();
	
}, 10000 );


function recalculateAxisSpan() {

	if( graphC && graphP && graphV ) {


		if( $("#follow-time").hasClass('active') ) {

			if( period ) {

				graphC.getBottomAxis().zoom( Date.now() - period, Date.now() + period / 10 );
				graphP.getBottomAxis().zoom( Date.now() - period, Date.now() + period / 10 );
				graphV.getBottomAxis().zoom( Date.now() - period, Date.now() + period / 10 );

						
				graphC.getLeftAxis().scaleToFitAxis( graphC.getBottomAxis(), false, undefined, undefined, false, true );
				graphP.getLeftAxis().scaleToFitAxis( graphP.getBottomAxis(), false, undefined, undefined, false, true );
				graphV.getLeftAxis().scaleToFitAxis( graphV.getBottomAxis(), false, undefined, undefined, false, true );


			} else {
			/*	
				graphC.autoscaleAxes();
				graphP.autoscaleAxes();
				graphV.autoscaleAxes();
			*/
			}

			graphC.draw();
			graphP.draw();
			graphV.draw();
		}
	}
}


 $( document ).ready( function() {

 	getStatus();
 	makeGraphs();

 	recalculateAxisSpan();

 	$("#form-device").on("click", "button[name=start]", function() {
 		
 		$.get("/startChannel/" + currentChannel, $("#form-device").serializeObject(), function() {
 			getStatus();
 		});
 	} );

 	$("#form-device").on("click", "button[name=pause]", function() {
 		$.get("/pauseChannel/" + currentChannel, $("#form-device").serializeObject(), function() {
 			getStatus();
 		});
 	} );

 	$("#form-device").on("click", "button[name=stop]", function() {
		
		graphC.getSerie("serie_" + currentChannel ).setData([]);
		graphP.getSerie("serie_" + currentChannel ).setData([]);
		graphV.getSerie("serie_" + currentChannel ).setData([]);
/*
		graphC.getSerie("serie_" + currentChannel + "_zone" ).setData([]);
		graphP.getSerie("serie_" + currentChannel + "_zone" ).setData([]);
		graphV.getSerie("serie_" + currentChannel + "_zone" ).setData([]);
*/
	 	graphC.draw();
	 	graphV.draw();
	 	graphP.draw();


/*		data[ currentChannel ].currents = [];
		data[ currentChannel ].voltages = [];
		data[ currentChannel ].powers = [];
		*/
/*
		data[ currentChannel ].currentsminmax = [];
		data[ currentChannel ].voltagesminmax = [];
		data[ currentChannel ].powersminmax = [];
*/

 		$.get("/stopChannel/" + currentChannel, $("#form-device").serializeObject(), function() {
 			getStatus();
 		});
 	} );

	$("#form-device").on("click", "button[name=update]", function() {
 		$.get("/updateChannel/" + currentChannel, $("#form-device").serializeObject(), function() {
 			getStatus();
 		});
 	});

	$("input[name=name]").on( "keyup", function() {
	 	var status = statusField.prop('value');
		if( status !== "running" ) {
			startButton.prop( 'disabled', $( this ).prop( 'value' ).length == 0 );
		}
	} );

	$(".time").on("click", function() {

		period = parseInt( $( this ).data( 'time' ) ) * 1000;

		if( $("#follow-time").hasClass('active')) {

			recalculateAxisSpan();
		} else {
			graphs.map( function( graph ) {

				var mid = ( graph.getBottomAxis().getCurrentMin() + graph.getBottomAxis().getCurrentMax() ) / 2;
				graph.getBottomAxis().zoom( mid - period / 2, mid + period / 2 );
				graph.getLeftAxis().scaleToFitAxis( graph.getBottomAxis(), false, false, false, false, true );
				graph.draw();
			} );
		}
		$( ".time" ).removeClass('active');
		$( this ).addClass( 'active' );

	} );


	$("#follow-time" ).on('click', function() {

		$( this ).toggleClass('active');
		recalculateAxisSpan();
	} );


	$(".time[data-time=600]").trigger('click');

 	var root = $( "#form-device" );
 	var statusField = $( "input[name=status]" );
 	var startButton = $( "button[name=start]", root );
 	var stopButton = $( "button[name=stop]", root );
 	var pauseButton = $( "button[name=pause]", root );
 	var updateButton = $( "button[name=update]", root );

 	root.on("submit", function( e ) {
 		e.preventDefault();
 	});

	function updateFormDevice( ) {

	 	
	 	var status = statusField.prop('value');

	 	if( status == "running" || status == "paused" ) {
	 		$("input[name=name]", root ).prop( 'readonly', true );
	 	} else {
	 		$("input[name=name]", root ).prop( 'readonly', false );
	 	}


	 	if( status == "running" ) {

	 		startButton.prop( 'disabled', true );
	 		stopButton.prop( 'disabled', false );
	 		pauseButton.prop( 'disabled', false );
	 		updateButton.prop( 'disabled', false );

	 	} else if( status == "paused" ) {

	 		startButton.prop( 'disabled', false );
	 		stopButton.prop( 'disabled', false );
	 		pauseButton.prop( 'disabled', true );
	 		updateButton.prop( 'disabled', true );
	 	
	 	} else {
	 		startButton.prop( 'disabled', false );
	 		stopButton.prop( 'disabled', true );
	 		pauseButton.prop( 'disabled', true );	
	 		updateButton.prop( 'disabled', true );
	 	}

	 	var name = $("input[name=name]");
	 	name.trigger( "keyUp" );
	 }



 function makeGraphs() {

 	var options = {

		plugins: {

			'timeSerieManager': { },
			'drag': { 
				dragY: false,
				persistanceX: false,


			onDragging: function() {

					$("#follow-time").removeClass('active');
					$(".time").removeClass('active');

			},

			onDragged: function() {

					var graph = this.graph;


					graphC.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphV.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphP.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );

					graphC.getLeftAxis().scaleToFitAxis( graphC.getBottomAxis(), false, undefined, undefined, false, true );
					graphP.getLeftAxis().scaleToFitAxis( graphP.getBottomAxis(), false, undefined, undefined, false, true );
					graphV.getLeftAxis().scaleToFitAxis( graphV.getBottomAxis(), false, undefined, undefined, false, true );


					graphC.draw();
					graphV.draw();
					graphP.draw();

					$("#follow-time").removeClass('active');
					$(".time").removeClass('active');

			}


			 },
			'zoom': { 

				zoomMode: 'x',
				transition: true,

				onZoomStart: function() {
					lockRedraw = true;
				},

				onZoomEnd: function( ) {

					var graph = this.graph;

					lockRedraw = false;

					graphC.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphV.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphP.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					

					graphC.getLeftAxis().scaleToFitAxis( graphC.getBottomAxis(), false, undefined, undefined, false, true );
					graphP.getLeftAxis().scaleToFitAxis( graphP.getBottomAxis(), false, undefined, undefined, false, true );
					graphV.getLeftAxis().scaleToFitAxis( graphV.getBottomAxis(), false, undefined, undefined, false, true );


					graphP.getPlugin('zoom').emit('zoomed');
					graphC.getPlugin('zoom').emit('zoomed');
					graphV.getPlugin('zoom').emit('zoomed');


					graphC.draw();
					graphV.draw();
					graphP.draw();

					period = graph.getBottomAxis().getCurrentMax() - graph.getBottomAxis().getCurrentMin();

					$("#follow-time").removeClass('active');
					$(".time").removeClass('active');
				},

				onDblClick: function( ) {

					var graph = this.graph;
					period = false;
					lockRedraw = false;
					$("#follow-time").removeClass('active');
					$(".time").removeClass('active');

					graphC.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphV.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphP.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
										
					graphC.getLeftAxis().scaleToFitAxis( graphC.getBottomAxis(), false, undefined, undefined, false, true );
					graphP.getLeftAxis().scaleToFitAxis( graphP.getBottomAxis(), false, undefined, undefined, false, true );
					graphV.getLeftAxis().scaleToFitAxis( graphV.getBottomAxis(), false, undefined, undefined, false, true );


					graphP.getPlugin('zoom').emit('zoomed');
					graphC.getPlugin('zoom').emit('zoomed');
					graphV.getPlugin('zoom').emit('zoomed');

					graphC.draw();
					graphV.draw();
					graphP.draw();

				}
			 }
		},

		pluginAction: {
			'zoom': { shift: true, ctrl: false },
			'drag': { shift: false, ctrl: false }
		},

		dblclick: {
			type: 'plugin',
			plugin: 'zoom',
			options: {
				mode: 'gradualX'
			}
		}
	};

 	var axes = { bottom: [ { type: 'time' } ] };
 	graphC = new Graph( $("#current").get( 0 ), options, axes ).resize( $("#graphs").width(), 400 );
 	graphV = new Graph( $("#voltage").get( 0 ), options, axes).resize( $("#graphs").width(), 400 );
 	graphP = new Graph( $("#power").get( 0 ), options, axes ).resize( $("#graphs").width(), 400 );

	var legend = graphC.makeLegend().setAutoPosition("bottom");
  	var legend = graphP.makeLegend().setAutoPosition("bottom");
  	var legend = graphV.makeLegend().setAutoPosition("bottom");


 	graphC
 		.getLeftAxis()
 		.setLabel("Current")
 		.setUnit("A")
 		.setScientific( true )
 		.setUnitDecade( true );

 	graphV
 		.getLeftAxis()
 		.setLabel("Voltage")
 		.setUnit("V")
 		.setScientific( true )
 		.setUnitDecade( true );

 	graphP
 		.getLeftAxis()
 		.setLabel("Power")
 		.setUnit("W")
 		.setScientific( true )
 		.setUnitDecade( true );


 	graphP.getLeftAxis().forceMin( -0.0001 ).setLineAt0( true );
 	graphC.getLeftAxis().forceMin( -0.0001 ).setLineAt0( true );
 	graphV.getLeftAxis().forceMin( -0.05 ).setLineAt0( true );

 	graphs = [ graphP, graphC, graphV ];
 	
 }

var defaultChannel = {
	status: "stopped",
	name: "available"
};

 function getStatus() {

 	var seriesC = [];
 	var seriesV = [];
 	var seriesP = [];

 	$.getJSON("/getCurrentStatus", {}, function( status ) {

 		var options = status.channels.channels.map( function( channel ) {
			
			var jsGraphOptions = ( ( status.channels.options[ channel ] || {} ).serie || {} );
			var jsGraphOptionsZone = ( ( status.channels.options[ channel ] || {} ).serie_zone || {} );

			status.devices[ channel ] = $.extend( true, {}, defaultChannel, status.devices[ channel ] );

			graphC.getPlugin("timeSerieManager").setURL("http://128.179.188.62:3001/getData?cellName=<measurement>&parameter=<parameter>&from=<from>&to=<to>&grouping=<interval>");
			graphV.getPlugin("timeSerieManager").setURL("http://128.179.188.62:3001/getData?cellName=<measurement>&parameter=<parameter>&from=<from>&to=<to>&grouping=<interval>");
			graphP.getPlugin("timeSerieManager").setURL("http://128.179.188.62:3001/getData?cellName=<measurement>&parameter=<parameter>&from=<from>&to=<to>&grouping=<interval>");

	 		seriesC.push( graphC.getPlugin("timeSerieManager").newSerie( "serie_" + channel + "", jsGraphOptions, 'line', { measurement: status.devices[ channel ].name.replace(/[^a-zA-Z0-9_]+/ig,'') + "_" + status.devices[ channel ].starttime, parameter: 'current' } ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" ) );
		 	seriesV.push( graphV.getPlugin("timeSerieManager").newSerie( "serie_" + channel + "", jsGraphOptions, 'line', { measurement: status.devices[ channel ].name.replace(/[^a-zA-Z0-9_]+/ig,'') + "_" + status.devices[ channel ].starttime, parameter: 'voltage' } ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" ) );
		 	seriesP.push( graphP.getPlugin("timeSerieManager").newSerie( "serie_" + channel + "", jsGraphOptions, 'line', { measurement: status.devices[ channel ].name.replace(/[^a-zA-Z0-9_]+/ig,'') + "_" + status.devices[ channel ].starttime, parameter: 'power' } ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" ) );

		 	graphC.getPlugin("timeSerieManager").updateZoneSerie( "serie_" + channel );
		 	graphV.getPlugin("timeSerieManager").updateZoneSerie( "serie_" + channel );
		 	graphP.getPlugin("timeSerieManager").updateZoneSerie( "serie_" + channel );


			[ graphC, graphP, graphV ].forEach( function( graphinstance ) {

				graphinstance.getBottomAxis().zoom( ( Date.now() - 10000000 ), Date.now() );
				graphinstance.draw(); // Now the markers appear
				graphinstance.getPlugin("timeSerieManager").update();
				graphinstance.getPlugin("timeSerieManager").registerPlugin( graphinstance.getPlugin('zoom'), 'dblClick' );
				graphinstance.getPlugin("timeSerieManager").registerPlugin( graphinstance.getPlugin('zoom'), 'zooming' );
				graphinstance.getPlugin("timeSerieManager").registerPlugin( graphinstance.getPlugin('zoom'), 'zoomed' );
				graphinstance.getPlugin("timeSerieManager").registerPlugin( graphinstance.getPlugin('drag'), 'dragging' );
				graphinstance.getPlugin("timeSerieManager").registerPlugin( graphinstance.getPlugin('drag'), 'dragged' );
	
				graphinstance.getPlugin("timeSerieManager").setIntervalCheck( 10000 );
			});
			

	 		//graphC.newSerie( "serie_" + channel + "_zone", jsGraphOptionsZone, "zone" ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" ).setLegend( false );
		 	//graphV.newSerie( "serie_" + channel + "_zone", jsGraphOptionsZone, "zone" ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" ).setLegend( false );
		 	//graphP.newSerie( "serie_" + channel + "_zone", jsGraphOptionsZone, "zone" ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" ).setLegend( false );


 			var ret = "Channel " + channel;
 			if( status.devices[ channel ] ) {
 				ret += ": " + status.devices[ channel ].name;

 				switch( status.devices[ channel ].status ) {
 					case 'running':
 						ret += " (running)";
 					break;

 					case 'paused':
 						ret += " (running)";
 					break;
 				}
 			}
 			return '<option value="' + channel + '" ' + ( currentChannel == channel ? ' selected="selected" ' : '' ) + '>' + ret + '</option>';
 		});


		graphC.getLegend().fixSeries( seriesC );
		graphP.getLegend().fixSeries( seriesP );
		graphV.getLegend().fixSeries( seriesV );
		
		graphC.updateLegend();
		graphP.updateLegend();
		graphV.updateLegend();



 		var selectChannels = $("#form-channels select.channels").html( options );//.populate( status );

 		$("#form-channels").on("change", function() {

 			var val = selectChannels.prop('value');

 			if( ! val ) {
 				return;
 			}

 			currentChannel = val;
 			status.devices[ val ] = $.extend( {}, status.devices.mask, status.devices[ val ] );
 			
 			$("#form-device").populate( status.devices[ val ] );
 			updateFormDevice();

 		}).trigger("change");
/*
 		if( ! socket ) {
 			makeSocket();
 		}

 		*/
 	});
 }



 });