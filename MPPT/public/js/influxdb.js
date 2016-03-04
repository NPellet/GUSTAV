
define( [ 'jquery', 'populate' ], function( $ ) {

	var form;

	var exports = {};

	exports.ready = function( _form ) {

		form = _form;

		form.on("submit", function( e ) {

			e.preventDefault();

			$.get("/setInfluxDBConfig", form.serializeObject(), function() {

				console.log( 'done' );
			} )

		});

 		$.getJSON("/getInfluxDBConfig", {}, function( config ) {

 			form.populate( config );
 		});
	}

	return exports;

})
