var lockRedraw;
var period;
var graphs;

var socket,
	maxTime = 0;

function makeSocket() {


	socket = new WebSocket("ws://127.0.0.1:8080");


	 socket.onopen = function() {
	 	
	     socket.send( JSON.stringify( { command: "getAll" } ) );
	 };

	var data = {};

	 socket.onmessage = function(e) {

	 	var d = JSON.parse( e.data );

	 	if( ! d.latest ) {
	 		d.latest = {};
	 	}


	 	for( var i = 0, l = d.data.length; i < l; i ++ ) {

	 		if( d.data[ i ].data.currents.length > 0 ) {

	 			data[ i ] = data[ i ] || {};
	 			data[ i ].currents = data[ i ].currents || [];
	 			data[ i ].voltages = data[ i ].voltages || [];
	 			data[ i ].powers = data[ i ].powers || [];

	 			data[ i ].currents = data[ i ].currents.concat( d.data[ i ].data.currents );
	 			data[ i ].voltages = data[ i ].voltages.concat( d.data[ i ].data.voltages );
	 			data[ i ].powers = data[ i ].powers.concat( d.data[ i ].data.powers );


				graphC.getSerie( "serie_" + d.data[ i ].deviceId + "" ).setData( data[ i ].currents );
				graphV.getSerie( "serie_" + d.data[ i ].deviceId + "" ).setData( data[ i ].voltages );
				graphP.getSerie( "serie_" + d.data[ i ].deviceId + "" ).setData( data[ i ].powers );
		
				maxTime = Math.max( data[ i ].powers[ data[ i ].powers.length - 1 ][ 0 ], maxTime );
			}
		}


		if( ! lockRedraw ) {

			recalculateAxisSpan();

		}


		socket.send( JSON.stringify( { command: "getLatest", latest: d.latest } ) );

		
	 };

	 socket.onclose = function() {
	     console.log('close');
	 };
};

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


function recalculateAxisSpan() {

	if( graphC && graphP && graphV ) {


		if( $("#follow-time").hasClass('active') ) {

			if( period ) {

				graphC.getBottomAxis().zoom( maxTime - period, maxTime + period / 10 );
				graphP.getBottomAxis().zoom( maxTime - period, maxTime + period / 10 );
				graphV.getBottomAxis().zoom( maxTime - period, maxTime + period / 10 );
			} else {
				graphC.autoscaleAxes();
				graphP.autoscaleAxes();
				graphV.autoscaleAxes();
			}
		}

		graphC.draw();
		graphP.draw();
		graphV.draw();
	}
}



 $( document ).ready( function() {

 	getStatus();
 	makeGraphs();

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


	 	graphC.draw();
	 	graphV.draw();
	 	graphP.draw();

 		$.get("/stopChannel/" + currentChannel, $("#form-device").serializeObject(), function() {
 			getStatus();
 		});
 	} );

	$("#form-device").on("change", function() {
 		$.get("/updateChannel/" + currentChannel, $("#form-device").serializeObject(), function() {
 			getStatus();
 		});
 	});

	$("input[name=name]").on( "keyUp", function() {
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
				graph.draw();
			} );
		}
		$( ".time" ).removeClass('active');
		$( this ).addClass( 'active' );

	} );

	$("#follow-time" ).on('click', function() {

		$( this ).toggleClass('active');
		console.log('sdf');
		recalculateAxisSpan();
	} );

 	var root = $( "#form-device" );
 	var statusField = $( "input[name=status]" );
 	var startButton = $( "button[name=start]", root );
 	var stopButton = $( "button[name=stop]", root );
 	var pauseButton = $( "button[name=pause]", root );


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

	 	} else if( status == "paused" ) {
	 		startButton.prop( 'disabled', false );
	 		stopButton.prop( 'disabled', false );
	 		pauseButton.prop( 'disabled', true );
	 	
	 	} else {
	 		startButton.prop( 'disabled', false );
	 		stopButton.prop( 'disabled', true );
	 		pauseButton.prop( 'disabled', true );	
	 	}

	 	var name = $("input[name=name]");
	 	name.trigger( "keyUp" );
	 }



 function makeGraphs() {

 	var options = {

		plugins: {
			'zoom': { zoomMode: 'x',
				onZoomStart: function() {
					lockRedraw = true;
				},

				onZoomEnd: function( graph ) {
					lockRedraw = false;

					graphC.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphV.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphP.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );

					graphC.draw();
					graphV.draw();
					graphP.draw();

					period = graph.getBottomAxis().getCurrentMax() - graph.getBottomAxis().getCurrentMin();

					$("#follow-time").removeClass('active');
					$(".time").removeClass('active');
				},

				onDblClick: function( graph ) {
					period = false;
					lockRedraw = false;
					$("#follow-time").addClass('active');
					$(".time").removeClass('active');

					graphC.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphV.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );
					graphP.getBottomAxis().zoom( graph.getBottomAxis().getCurrentMin(), graph.getBottomAxis().getCurrentMax() );

					graphC.draw();
					graphV.draw();
					graphP.draw();

				}
			 }
		},

		pluginAction: {
			'zoom': { shift: false, ctrl: false }
		},

		dblclick: {
			type: 'plugin',
			plugin: 'zoom',
			options: {
				mode: 'total'
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

/*
 	graphP.getLeftAxis().forceMin( 0 );
 	graphC.getLeftAxis().forceMin( 0 );
 	graphV.getLeftAxis().forceMin( 0 );
*/
 	graphs = [ graphP, graphC, graphV ];
 	
 }

 function getStatus() {

 	$.getJSON("/getCurrentStatus", {}, function( status ) {

 		var options = status.channels.channels.map( function( channel ) {
			
			var jsGraphOptions = ( ( status.channels.options[ channel ] || {} ).serie || {} );

			status.devices[ channel ] = status.devices[ channel ] || { name: "unused"};

	 		graphC.newSerie( "serie_" + channel + "", jsGraphOptions ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" );
		 	graphV.newSerie( "serie_" + channel + "", jsGraphOptions ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" );
		 	graphP.newSerie( "serie_" + channel + "", jsGraphOptions ).autoAxis().setLabel( status.devices[ channel ].name + " (" + channel + ")" );


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

 		makeSocket();
 	});
 }



 });