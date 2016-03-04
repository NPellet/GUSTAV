
define( [ 'json!params', 'js/influxdb', 'jsgraph', 'tinycolor', 'bootstrap', 'populate' ], function( params, influxdb, Graph, tinycolor ) {

	var period = 100;

	setInterval( function() {
		recalculateAxisSpan();
	}, params.client.graphRefreshRate * 5 );


	function recalculateAxisSpan() {

		if( $("#follow-time").hasClass('active') ) {

			if( period ) {
				graphs( function( graph ) {
					graph.getBottomAxis().zoom( Date.now() - period, Date.now() + period / 10 );	
					graph.getLeftAxis().scaleToFitAxis( graph.getBottomAxis(), false, undefined, undefined, true, true );
				});
			}
			
			graphs( function( graph ) {
				graph.draw();
			});

		}
	}

	var graphs;

	$( document ).ready( function() {

	 	graphs = makeGraphs();
	 	recalculateAxisSpan();

	 	influxdb.ready( $("#form-influxdb"));
		//tracestyle.setDom( $("#tracestyle") );	 	

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

				//$( this ).parent().parent().
			})

			var currentConnectedDevices = {};

	 		function updateList() {
	 			
	 			var somethingChanged = false;

	 			$.getJSON("/getConnectedDevices", function( devices ) {

	 				var li;
	 				for( var i in devices ) {

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
	 		console.log( currentInstrument, currentChannel );
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
				graphs( function( graph ) {

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


 		$("#form-channels").on("change", function() {
 			var val = $("#channels").prop('value');
				
 			updateFormDevice.apply( this, val.split("_") );
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

	function updateFormDevice( group, channel  ) {

		currentChannel = channel;
		currentInstrument = group; 
		
		
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



	 function makeGraphs() {

	 	var options = {

			plugins: {

				'timeSerieManager': {

					intervals: [ 1000, 2000, 15000, 60000, 900000, 3600000, 8640000 ]
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

					graphs( function( graph ) {
						graph.getBottomAxis().zoom( min, max );
						graph.getLeftAxis().scaleToFitAxis( graph.getBottomAxis(), false, undefined, undefined, true, true );
						graph.draw();
					});
					
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

						graphs( function( graph ) {
							graph.getBottomAxis().zoom( min, max );
							graph.getLeftAxis().scaleToFitAxis( graph.getBottomAxis(), false, undefined, undefined, true, true );
							graph.getPlugin('zoom').emit('zoomed');
							
							graph.draw();
						} );
						
						period = max - min;

						$("#follow-time").removeClass('active');
						$(".time").removeClass('active');
					},

					onDblClick: function( ) {

						var min = this.graph.getBottomAxis().getCurrentMin(),
							max = this.graph.getBottomAxis().getCurrentMax();


						var graph = this.graph;
						period = false;
						lockRedraw = false;
						$("#follow-time").removeClass('active');
						$(".time").removeClass('active');

						graphs( function( graph ) {
							graph.getBottomAxis().zoom( min, max );
							graph.getLeftAxis().scaleToFitAxis( graph.getBottomAxis(), false, min, max, true, true );
							graph.getPlugin('zoom').emit('zoomed');
							
							graph.draw();
						} );
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

		var graphConstruction = [
			{
				yUnit: "A",
				yLabel: "Current",
				divId: "current",
				timeseriemanagerserieparam: "current"

			},

			{
				yUnit: "V",
				yLabel: "Voltage",
				divId: "voltage",
				timeseriemanagerserieparam: "voltage"
			},

			{
				yUnit: "W",
				yLabel: "Power output",
				divId: "power",
				timeseriemanagerserieparam: "power"
			}

		];


		var graphInstances = [];

	 	graphConstruction.map( function( el ) {
	 		var axes = { 
	 			bottom: [ 
	 				{ 
	 					type: 'time'
	 				}
	 			],

	 			left: [
	 				{
	 					scientificScale: true,
	 					engineeringScale: true,
	 					unit: el.yUnit,
	 					unitDecade: true,
	 					labelValue: el.yLabel
	 				}
	 			]
	 		};

	 		var graph = new Graph( $("#" + el.divId ).get( 0 ), options, axes )
	 							.resize( $("#graphs").width(), 400 );

	 		//graph.getLeftAxis().forceMin( 0 );

	 		graph.timeseriemanagerserieparam = el.timeseriemanagerserieparam;
	 		graphInstances.push( graph );
	 	} );


	 	var graphs = ( function( callback ) {
	 		
	 		return graphInstances.map( callback );
	 	});

	 	graphs( function( graph ) {

	 		graph.makeLegend().setAutoPosition("bottom");
			graph.getPlugin("timeSerieManager").setURL("http://127.0.0.1:3001/getData?cellName=<measurement>&parameter=<parameter>&from=<from>&to=<to>&grouping=<interval>");

			graph.getPlugin("timeSerieManager").registerPlugin( graph.getPlugin('zoom'), 'dblClick' );
			graph.getPlugin("timeSerieManager").registerPlugin( graph.getPlugin('zoom'), 'zooming' );
			graph.getPlugin("timeSerieManager").registerPlugin( graph.getPlugin('zoom'), 'zoomed' );
			graph.getPlugin("timeSerieManager").registerPlugin( graph.getPlugin('drag'), 'dragging' );
			graph.getPlugin("timeSerieManager").registerPlugin( graph.getPlugin('drag'), 'dragged' );
			graph.getPlugin("timeSerieManager").setIntervalCheck( params.client.graphRefreshRate );


	 	});


		/*

	 	graphP.getLeftAxis().forceMin( -0.0001 ).setLineAt0( true );
	 	graphC.getLeftAxis().forceMin( -0.0001 ).setLineAt0( true );
	 	graphV.getLeftAxis().forceMin( -0.05 ).setLineAt0( true );
*/

		return graphs;
		
	 }

	var defaultChannel = {
		status: "stopped",
		name: "available"
	};

	var channels;
	function getChannels() {

		graphs( function( graph ) {
			graph.getLegend().fixSeries([]);
		});

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
					html += '<option value="' + i + '_' + channels[ i ][ j ].channelId + '">' + label + ( running ? ' (running)' : ' (available)' ) + '</option>';

					var exists = false;
					graphs( function( graph ) {

						seriename = "serie_" + i + "_" + channels[ i ][ j ].channelId;

						if( ! graph.getSerie( seriename ) && running ) {

							graph
								.getPlugin("timeSerieManager")
								.newSerie( 
									seriename,
									{ lineWidth: 2 },
									'line',
									{ 
										measurement: channels[ i ][ j ].filename,
										parameter: graph.timeseriemanagerserieparam
									} 
								)
								.autoAxis()
								.setLabel( channels[ i ][ j ].name + " (" + channels[ i ][ j ].channelId + ")" );

							graph
								.getPlugin("timeSerieManager")
								.updateZoneSerie( seriename );

							//graph.getSerie( seriename )._zoneSerie.autoAxis();

							graph.getLegend().fixSeriesAdd( graph.getSerie( seriename ) );
							
							exists = true;
						} else if( graph.getSerie( seriename ) && ! running ) {

							graph.getSerie( seriename )._zoneSerie.kill();
							graph.getSerie( seriename ).kill();

						} else if( running ) {

							graph.getLegend().fixSeriesAdd( graph.getSerie( seriename ) );
							
							exists = true;
						}

						if( running ) {
							allnames[ seriename ] = seriename;
						}
					});
	
					if( exists ) {

				/*		var bundle = [];

						graphs( function( graph ) {

							bundle.push( graph.getSerie( seriename ) );
							bundle.push( graph.getSerie( seriename )._zoneSerie );

						} );
*/
				//		tracestyle.addSeriesBundle( seriename, label, bundle );
					}
				}

				html += '</optgroup>';
			}


			var l = Object.keys( allnames ).length;

			var j = 0;

			for( var i in allnames ) {

				color = tinycolor( { h: j * 270 / l, s: 1, l: .4 } );

				graphs( function( graph ) {

					var s = graph.getSerie( i );
					s.setLineColor( "#" + color.toHex() );

					if( s._zoneSerie ) {
						s._zoneSerie.setLineColor( "#" + color.toHex() );
						s._zoneSerie.setFillColor( "#" + color.toHex() );
					}

				} );

				j++;
			}


	//		tracestyle.makeHtml();

			graphs( function( graph ) {
				graph.getLegend().update();
			});

			$("#channels").html( html );
		} );
	}


	});
});
