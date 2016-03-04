

define( [ 'jquery', 'jsgraph', 'bootstrap'], function( $, Graph ) {

	var dom;
	var series = {};


	exporting = {};

	exporting.addSeriesBundle = function( _seriesName, label, _series ) {

		series[ _seriesName ] = { label: label, series: _series };
	}

	exporting.setDom = function( _dom ) {
		dom = _dom;

		dom.on("click", ".width *,.style *", function() {
console.log($(this).html());
			$( this ).parent().prev().html( $( this ).html() );

		});
	}

	exporting.makeHtml = function() {

		var html = '';
console.log( series );
		for( var i in series ) {

			html += '<div class="row"><div class="col-sm-3">' + series[ i ].label + '</div>'
				+ '<div class="col-sm-3">'
					  + '<div class="btn-group">'
						+ '<button type="button" class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown">Color</button>'
						+ '<div class="dropdown-menu color"></div>'
					  + '</div>'
				+ '</div>'
				+ '<div class="col-sm-3">'
					+'<div class="btn-group">'
						+ '<button type="button" class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown">Width</button>'
						+ '<div class="dropdown-menu width">'
							+ '<a class="dropdown-item" href="#" data-value="1"><svg width="30" height="10"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-width="1" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="2"><svg width="30" height="10"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-width="2" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="3"><svg width="30" height="10"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-width="3" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="4"><svg width="30" height="10"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-width="4" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="5"><svg width="30" height="10"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-width="5" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="6"><svg width="30" height="10"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-width="6" /></svg></a>'
						+ '</div>'
					+ '</div>'
				+ '</div>'
				+ '<div class="col-sm-3">'
					+'<div class="btn-group">'
						+ '<button type="button" class="btn btn-default btn-sm dropdown-toggle" data-toggle="dropdown">Style</button>'
						+ '<div class="dropdown-menu style">'
							+ '<a class="dropdown-item" href="#" data-value="1"><svg width="30" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="2"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="1,1" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="3"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="3,3" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="4"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="4,4" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="5"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="5,5" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="6"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="5 2" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="7"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="2 5" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="8"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="4 2 4 4" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="9"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="1,3,1" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="10"><svg width="100" height="20"><line x1="0" x2="40" y1="5" y2="5" stroke="black" stroke-dasharray="9 2" /></svg></a>'
							+ '<a class="dropdown-item" href="#" data-value="11"><svg width="100" height="20"><line x1="20" x2="80" y1="10" y2="10" stroke="black" stroke-dasharray="2 9" /></svg></a>'
						+ '</div>'
					+ '</div>'
				+' </div></div>';
		}

		dom.html( html );


	}

	return exporting;

} );