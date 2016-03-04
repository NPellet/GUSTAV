
requirejs.config({
    
    baseUrl: '',
    paths: {
        bootstrap: './lib/bootstrap/dist/js/bootstrap.min',
        jquery: './lib/jquery/dist/jquery.min',
        jsgraph: './lib/jsgraph/dist/jsgraph',
        populate: './lib/jquery.populate/jquery.populate',
        text: './lib/requirejs-plugins/lib/text',
        json: './lib/requirejs-plugins/src/json',
        colorpicker: './lib/mjolnic-bootstrap-colorpicker/dist/js/bootstrap-colorpicker',
        tracestyle: 'js/tracestyle',
        tinycolor: './lib/tinycolor/tinycolor'
    },
    shim: {
    	populate: [ 'jquery' ],
    	bootstrap: [ 'jquery' ]
    }
});

requirejs( [ "js/util", "js/ui" ], function( util, ui ) {


});
