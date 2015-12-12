

var sock = new SockJS('localhost:9999/socket');
 
 sock.onopen = function() {
 	console.log( sock );
     sock.send( JSON.stringify( { command: "getAll" } ) );
 };

var data = {};

 sock.onmessage = function(e) {

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

			graphC.getSerie( d.data[ i ].deviceId.toString() ).setData( data[ i ].currents );
			graphV.getSerie( d.data[ i ].deviceId.toString() ).setData( data[ i ].voltages );
			graphP.getSerie( d.data[ i ].deviceId.toString() ).setData( data[ i ].powers );
		}
	}

	graphC.autoscaleAxes();
	graphC.draw();

	graphP.autoscaleAxes();
	graphP.draw();
	
	graphV.autoscaleAxes();
	graphV.draw();

	sock.send( JSON.stringify( { command: "getLatest", latest: d.latest } ) );
 };

 sock.onclose = function() {
     console.log('close');
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

 		graphC.getSerie("5").setData([]);
	 	graphV.newSerie("5").setData([]);
	 	graphP.newSerie("5").setData([]);

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
			'zoom': { zoomMode: 'x' }
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
 	graphC = new Graph( $("#current").get( 0 ), options, axes ).resize( 800, 300 );
 	graphV = new Graph( $("#voltage").get( 0 ), options, axes).resize( 800, 300 );
 	graphP = new Graph( $("#power").get( 0 ), options, axes ).resize( 800, 300 );

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


 	graphC.newSerie("5").autoAxis();
 	graphV.newSerie("5").autoAxis();
 	graphP.newSerie("5").autoAxis();

 }

 function getStatus() {

 	$.getJSON("/getCurrentStatus", {}, function( status ) {

 		var options = status.channels.channels.map( function( channel ) {
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
 	});
 }



 });