
define( [ 'json!params', 'js/influxdb', 'jquery', 'jsgraph', 'tinycolor', 'bootstrap', 'populate' ], function( params, influxdb, $, Graph, tinycolor ) {

	var period = 100;

	setInterval( function() {
		recalculateAxisSpan();
	}, params.client.graphRefreshRate * 5 );

	var mainGraphs;

	function recalculateAxisSpan() {

		if( $("#follow-time").hasClass('active') ) {

			if( period ) {

				mainGraph.getBottomAxis().zoom( Date.now() - period, Date.now() + period / 10 );
				mainGraph.getLeftAxis().scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );

			}

			mainGraph.draw();
		}
	}


		var graphConstruction = [
			{
				yUnit: "A",
				yLabel: "Current",
				divId: "current",
				timeseriemanagerserieparam: "current",
				span: [ 0, 0.33 ]

			},

			{
				yUnit: "V",
				yLabel: "Voltage",
				divId: "voltage",
				timeseriemanagerserieparam: "voltage",
				span: [ 0.36, 0.66 ]
			},

			{
				yUnit: "W",
				yLabel: "Power output",
				divId: "power",
				timeseriemanagerserieparam: "power",
				span: [ 0.68, 1 ]
			}

		];


	$( document ).ready( function() {

	 	mainGraph = makeGraph();
	 	recalculateAxisSpan();

	 	influxdb.ready( $("#form-influxdb"));
		//tracestyle.setDom( $("#tracestyle") );

		$( window ).on( 'resize', function() {
			mainGraph.resize( $("#graphs").width(), 800 );
		});



	 	( function() {

	 		var port;

		 	var button = $("#discover"),
		 		buttonConnect = $("#connect"),
		 		list = $("#port-list"),
		 		connected_list = $( "#connected-devices" );

			setInterval( function( ) {
				updateList();
			}, 10000 );

		 	button.on("click", function() {

		 		var $this = $( this );
		 		if( $( this ).hasClass("searching") ) {
		 			return;
		 		}

		 		var discovering = true;
		 		var discoveryTimeout = setTimeout( function() {

		 			$this
		 				.removeClass("searching")
		 				.addClass("btn-danger")
		 				.text( $this.data( "text-error" ) )
		 				.children('span.glyphicon')
		 				.remove();

		 			discovering = false;
		 			discoveryTimeout = false;

		 		}, 2000 );

		 		$( this )
		 			.text( $this.data("text-searching") )
		 			.removeClass('btn-danger')
		 			.append( '<span class="glyphicon glyphicon-refresh spinning" aria-hidden="true"></span>' )
		 			.addClass( "searching" );


		 		$.getJSON("/discover", function( response ) {

		 			if( discoveryTimeout ) {
		 				clearTimeout( discoveryTimeout );
		 			}

		 			list.empty();

		 			list.append('<option disabled="disabled" selected="selected">' + response.length + ' serial ports found</option>');

		 			response.map( function( port ) {
		 				list.append('<option name="' + port.name + '">' + port.name + '</option>');
		 			} );

		 			button
		 				.removeClass("searching")
		 				.text( $this.data( "text-search" ) )
		 				.children('span.glyphicon')
		 				.remove();

		 		} );

		 	} );

			buttonConnect.on( "click", function() {

				var $this = $( this );


				if( port ) {

					var connectingTimeout = setTimeout( function() {

			 			$this
			 				.removeClass("searching")
			 				.text( $this.data( "text-connect" ) )
			 				.prop( 'disabled', false )
			 				.children('span.glyphicon')
			 				.remove();

			 			conencting = false;
			 			connectingTimeout = false;

			 		}, 3000 );


					$.getJSON("/connect", { port: port }, function( response ) {

						if( response.error ) {

							$("#error-connection")
								.modal("show")
								.find('.portname')
								.text( response.port )
								.end()
								.find('.errordetails')
								.text( response.errorText );

							$this
								.text( $this.data("text-connect" ) )
								.removeClass("connecting")
								.prop( 'disabled', false )
								.children('span')
								.remove();

						} else {

							updateList();
						}
					} );

					$( this )
			 			.text( $this.data("text-connecting") )
			 			.prop('disabled', true )
			 			.append( '<span class="glyphicon glyphicon-refresh spinning" aria-hidden="true"></span>' )
			 			.addClass( "connecting" );
				}
			} );


			list.on("change", function() {

	 			port = list.prop('value');
	 			if( port ) {
	 				buttonConnect.prop( 'disabled', false );
	 			}
	 		} );

			connected_list.on("click", ".status-remove", function() {

				$.getJSON("/removeDevice", { deviceName: $( this ).parent().parent().data( 'device-name' ) }, function(  ) {
					updateList();
				});
				$( this ).parent().parent().remove();

			})

			var currentConnectedDevices = {};

	 		function updateList() {

	 			var somethingChanged = false;

	 			$.getJSON("/getConnectedDevices", function( devices ) {

	 				var li;
	 				for( var i in devices ) {

						if( ! devices[ i ].name ) {
							continue;
						}

	 					if( ! currentConnectedDevices[ i ] || currentConnectedDevices[ i ].error !== devices[ i ].error ) {

	 						somethingChanged = true;
	 					}


	 					if( ( li = connected_list.find('li[data-device-name="' + devices[ i ].name + '"]' ) ).length == 0 ) {
	 						li = $('<li data-device-name="' + devices[ i ].name + '" class="list-group-item"><span>' + devices[ i ].name + '</span></li>');
	 						li.append( '<span class="btn-group pull-right"></span>');
	 						connected_list.append( li );
	 					}


	 					if( devices[ i ].error ) {
	 						li.find( 'button.status-connected' ).remove();
	 						li.removeClass('text-success');
	 					} else {
	 						li.find( 'button.status-error' ).remove();
	 						li.removeClass('text-danger');
	 					}

	 					if( ! devices[ i ].error ) {

	 						if( li.find('button.status-connected').length == 0 ) {
	 							li.addClass('text-success');
	 							li.find('.pull-right').append('<button class="status-connected btn btn-xs btn-success"><span class="glyphicon glyphicon-ok"></span></button>');
	 						}

	 					} else {

	 						if( li.find('button.status-error').length == 0 ) {
	 							li.addClass('text-danger');
	 							li.find('.pull-right').append('<button readonly="readonly" class="status-error btn btn-xs btn-danger"><span class="glyphicon glyphicon-warning-sign"></span></button>');
	 							li.find('.pull-right').append('<button class="status-error status-remove btn btn-xs btn-danger">Remove</button>');
	 						}
	 					}
	 				}

	 				currentConnectedDevices = devices;

	 				if( somethingChanged ) {
	 					getChannels();
	 				}
	 			} );
	 		}

	 		updateList();

		} ) ();



	 	$("#form-device").on("click", "button[name=start]", function() {

	 		$.get("/startChannel/" + currentInstrument + "/" + currentChannel, $("#form-device").serializeObject(), function() {
	 			getChannels();
	 		});
	 	} );

	 	$("#form-device").on("click", "button[name=pause]", function() {
	 		$.get("/pauseChannel/" + currentInstrument + "/" + currentChannel, $("#form-device").serializeObject(), function() {
	 			getChannels();
	 		});
	 	} );

	 	$("#form-device").on("click", "button[name=stop]", function() {

			/*graphs( function( graph ) {
				graph.getSerie("serie_" + currentChannel ).setData([]);
				graph.draw();
			});
			*/
	 		$.get("/stopChannel/" + currentInstrument + "/" + currentChannel, $("#form-device").serializeObject(), function() {
	 			getChannels();
	 		});
	 	} );

		$("#form-device").on("click", "button[name=update]", function() {
	 		$.get("/updateChannel/" + currentInstrument + "/" + currentChannel, $("#form-device").serializeObject(), function() {
	 			getChannels();
	 		});
	 	});


		$("#form-device").on("click", "button[name=download]", function() {
			document.location.href = "/downloadChannel/" + currentInstrument + "/" + currentChannel;
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

				var mid = ( mainGraph.getBottomAxis().getCurrentMin() + mainGraph.getBottomAxis().getCurrentMax() ) / 2;
				mainGraph.getBottomAxis().zoom( mid - period / 2, mid + period / 2 );
				mainGraph.getLeftAxis().scaleToFitAxis( graph.getBottomAxis(), false, false, false, false, true );
				mainGraph.draw();
			}

			$( ".time" ).removeClass('active');
			$( this ).addClass( 'active' );

		} );


		$("#follow-time" ).on('click', function() {

			$( this ).toggleClass('active');
			recalculateAxisSpan();
		} );


		$(".time[data-time=600]").trigger('click');


 		$("#form-channels-config").on("change", function() {
 			var val = $(".channels", this ).prop('value');
 			console.log( val );
 			updateFormDevice.apply( this, val.split(";") );
 		});


 		$("#form-channels-jsc").on("change", function() {

 		});



 	//	$(".colorpicker").colorpicker();

	 	var root = $( "#form-device" );
	 	var statusField = $( "input[name=status]" );
	 	var startButton = $( "button[name=start]", root );
	 	var stopButton = $( "button[name=stop]", root );
	 	var pauseButton = $( "button[name=pause]", root );
	 	var updateButton = $( "button[name=update]", root );

	 	root.on("submit", function( e ) {
	 		e.preventDefault();
	 	});

	function updateFormDevice( group, channel ) {

		currentChannel = channel;
		currentInstrument = group;

		console.log( channel, channels, group );
		for( var i = 0, l = channels[ group ].length; i < l ; i ++ ) {

			if( channels[ group ][ i ].channelId == channel ) {

				$("#form-device").populate( channels[ group ][ i ] );
				break;
			}
		}

		var root = $("#form-device");
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
	 	name.trigger( "keyup" );
	 }



	 function makeGraph() {

	 	var options = {

			plugins: {

				'timeSerieManager': {

					intervals: [ 1000, 5000, 15000, 60000, 900000, 1800000, 3600000, 8640000 ]
				},
				'drag': {
					dragY: false,
					persistanceX: false,


				onDragging: function() {
					$("#follow-time").removeClass('active');
					$(".time").removeClass('active');
				},

				onDragged: function() {

					var min = this.graph.getBottomAxis().getCurrentMin(),
						max = this.graph.getBottomAxis().getCurrentMax();


					mainGraph.getLeftAxis( 0 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
					mainGraph.getLeftAxis( 1 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
					mainGraph.getLeftAxis( 2 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );

					mainGraph.draw();


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

						var min = this.graph.getBottomAxis().getCurrentMin(),
							max = this.graph.getBottomAxis().getCurrentMax();

						lockRedraw = false;

						mainGraph.getLeftAxis( 0 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
						mainGraph.getLeftAxis( 1 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
						mainGraph.getLeftAxis( 2 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );

						mainGraph.draw();


						period = max - min;
						$("#follow-time").removeClass('active');
						$(".time").removeClass('active');
					},

					onDblClick: function( ) {

						var min = mainGraph.getBottomAxis().getCurrentMin(),
							max = mainGraph.getBottomAxis().getCurrentMax();

						period = false;
						lockRedraw = false;

						$("#follow-time").removeClass('active');
						$(".time").removeClass('active');

						mainGraph.getLeftAxis( 0 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
						mainGraph.getLeftAxis( 1 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
						mainGraph.getLeftAxis( 2 ).scaleToFitAxis( mainGraph.getBottomAxis(), false, undefined, undefined, true, true );
						mainGraph.draw();
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


 		var axes = {
 			bottom: [
 				{
 					type: 'time'
 				}
 			],

 			left: [ ]
 		};


		graphConstruction.map( function( el ) {

			axes.left.push(
				{
					scientificScale: true,
					engineeringScale: true,
					unit: el.yUnit,
					unitDecade: true,
					labelValue: el.yLabel,
					span: el.span
				}
			);

	 	} );

	 	mainGraph = new Graph( $("#graph-main" ).get( 0 ), options, axes ).resize( $("#graphs").width(), 800 );

 		mainGraph.makeLegend().setAutoPosition("bottom");
		mainGraph.getPlugin("timeSerieManager").setURL("http://" + document.location.hostname + ":3001/getData?cellName=<measurement>&parameter=<parameter>&from=<from>&to=<to>&grouping=<interval>");

		mainGraph.getPlugin("timeSerieManager").registerPlugin( mainGraph.getPlugin('zoom'), 'dblClick' );
		mainGraph.getPlugin("timeSerieManager").registerPlugin( mainGraph.getPlugin('zoom'), 'zooming' );
		mainGraph.getPlugin("timeSerieManager").registerPlugin( mainGraph.getPlugin('zoom'), 'zoomed' );
		mainGraph.getPlugin("timeSerieManager").registerPlugin( mainGraph.getPlugin('drag'), 'dragging' );
		mainGraph.getPlugin("timeSerieManager").registerPlugin( mainGraph.getPlugin('drag'), 'dragged' );
		mainGraph.getPlugin("timeSerieManager").setIntervalCheck( params.client.graphRefreshRate );


		return mainGraph;

	 }

	var defaultChannel = {
		status: "stopped",
		name: "available"
	};

	var channels;
	function getChannels() {


		mainGraph.getLegend().fixSeries([]);


		$.getJSON("/getChannels", {}, function( ch ) {

			channels = ch;

			var allnames = {};
			var running;
			var html = '<option disabled="disabled" selected="selected">Select a channel</option>';

			for( var i in channels ) {

				html += '<optgroup label="' + i + '">';

				for( var j = 0; j < channels[ i ].length; j ++ ) {

					var label = ( channels[ i ][ j ].name || channels[ i ][ j ].channelName );
					running = ( channels[ i ][ j ].status == 'paused' || channels[ i ][ j ].status == 'running' );
					html += '<option value="' + i + ';' + channels[ i ][ j ].channelId + '" class="' + ( running ? 'running' : '' ) + '">' + label + ( running ? ' (running)' : ' (available)' ) + '</option>';

					var exists = false;

					graphConstruction.map( function( el, index ) {

						seriename = "serie_" + i + "_" + channels[ i ][ j ].channelId + "_" + el.timeseriemanagerserieparam;

						if( ! mainGraph.getSerie( seriename ) && running ) {

							mainGraph
								.getPlugin("timeSerieManager")
								.newSerie(
									seriename,
									{ lineWidth: 2 },
									'line',
									{
										measurement: channels[ i ][ j ].filename,
										parameter: el.timeseriemanagerserieparam
									}
								)
								.autoAxis()
								.setYAxis( mainGraph.getLeftAxis( index ) )
								.setLabel( channels[ i ][ j ].name + " (" + channels[ i ][ j ].channelId + ")" );

							mainGraph
								.getPlugin("timeSerieManager")
								.updateZoneSerie( seriename );

							//graph.getSerie( seriename )._zoneSerie.autoAxis();

							if( index == 0 ) {
								mainGraph.getLegend().fixSeriesAdd( mainGraph.getSerie( seriename ) );
							}

							exists = true;

						} else if( mainGraph.getSerie( seriename ) && ! running ) {

							mainGraph.getSerie( seriename )._zoneSerie.kill();
							mainGraph.getSerie( seriename ).kill();

						} else if( running ) {

							mainGraph.getLegend().fixSeriesAdd( mainGraph.getSerie( seriename ) );

							exists = true;
						}

						if( running ) {
							var globalSerieName = "serie_" + i + "_" + channels[ i ][ j ].channelId
							allnames[ globalSerieName ] = allnames[ globalSerieName ] || [];
							allnames[ globalSerieName ].push( seriename );
						}
					});
				}

				html += '</optgroup>';
			}


			var l = Object.keys( allnames ).length;

			var j = 0;

			for( var i in allnames ) {

				color = tinycolor( { h: j * 270 / l, s: 1, l: .4 } );

				allnames[ i ].map( function( name ) {

					var s = mainGraph.getSerie( name );
					s.setLineColor( "#" + color.toHex() );

					if( s._zoneSerie ) {
						s._zoneSerie.setLineColor( "#" + color.toHex() );
						s._zoneSerie.setFillColor( "#" + color.toHex() );
					}
				} );

				j++;
			}

			mainGraph.getLegend().update();
console.log( html );
			$(".channels").html( html );
			$("#form-channels-jsc .channels").find('.running').prop('disabled', true );
		} );
	}


	});
});
