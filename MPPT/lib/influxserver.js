var express = require('express');
var app = express();
var bodyParser = require('body-parser')
var influx = require('influx')
var fs = require('fs');
var params = JSON.parse( fs.readFileSync( 'params.json' ) );
var util = require("./util");

var configInfluxDb = {
    host: 'influxdb.epfl.ch',
    username: 'lpi',
    password: 'lpi77',
    port: 88,
    database: 'lpi'
};

var client;

app.use( bodyParser.json() ); 


var ip = util.getIp();

// Add headers
app.use(function (req, res, next) {

    res.setHeader('Access-Control-Allow-Origin', 'http://' + ip + ':' + params.server.port );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    res.type("application/json");

    next(); // End middleware
});


app.get('/makeDB', function (req, res) {
  
  client.getDatabaseNames( function( err, databases ) {

        if (err) {
            throw err;
        }

        console.log( "List of existing databases: " + databases );

        if ( ! ~databases.indexOf(database) ) {
            client.createDatabase(database, function (err) {
                if (err) throw err
                res.send('Database '+database+' created');
                
            })
        } else {
            res.send('Database ' + database + ' exists');
        }
    });
});


app.post('/saveData', function( req, res ) {

    var cellName = req.body.cellName;
    var data = req.body.data;

    if( ! client ) {
        //console.log( res );
        res.send( {
            status: 0,
            error: "No client connected"
        } );
        return;
    }

    client.writePoints( cellName, data, function( err ) {
        if (err) {
            console.log(err);

            res.send( {
                status: 0,
                error: err
            } );

            return;
        }
        
        res.send( {
            status: 1,
            error: false
        } );
    } );
} );

app.get("/getData", function( req, res ) {
    
    if( ! client ) {
        res.send( {
            status: 0,
            error: "No client connected"
        } );
        return;
    }

    var timeFrom = parseInt( req.query.from ) * 1000000; // to ns
    var timeTo = parseInt( req.query.to ) * 1000000; // to ns

    var grouping = req.query.grouping / 1000; // to seconds

    var cellName = req.query.cellName;
    var parameter = req.query.parameter;

    var paramMax = parameter + "max";
    var paramMin = parameter + "min";

    if( parameter == "power" ) {
        paramMax = parameter;
        paramMin = parameter;
    }

    query = "SELECT MEAN(" + parameter + ") AS mean, MAX(" + paramMax + ") AS max, MIN(" + paramMin + ") AS min FROM " + cellName + " WHERE ( time >= " + timeFrom + " AND time < " + timeTo+ " ) GROUP BY time(" + ( grouping ) + "s) FILL(none)";

    client.query(query, function(err, results) {

        if (err) {

            res.send( {
                status: 0,
                error: err.toString(),
                data: []
            } );

            return;
        }

        var dataMean = [],
            dataMinMax = [];

        for( var i = 0, l = results[ 0 ].length; i < l; i ++ ) {

            var time = new Date( results[ 0 ][ i ].time );

            if( results[ 0 ][ i ].mean > 3 || results[ 0 ][ i ].min > 3 || results[ 0 ][ i ].max > 3 ) {
                continue;
            }

            dataMean.push( time.getTime() );
            dataMean.push( results[ 0 ][ i ].mean );

            dataMinMax.push( time.getTime() );
            dataMinMax.push( results[ 0 ][ i ].min );
            dataMinMax.push( results[ 0 ][ i ].max );
        }

        
        res.send( { 

            status: 1,
            error: false,
            data: {
                mean: dataMean,
                minmax: dataMinMax    
            }
        } );
    } );
} );


app.get("/export", function( req, res ) {

    if( ! client ) {

        res.send( {
            status: 0,
            error: "No client connected"
        } );
        return;
    }

    var cellName = req.query.cellName;
    
    client.query( "SELECT voltage AS voltage, voltagemax, voltagemin, current, currentmax, currentmin, power FROM " + cellName, function( err, results ) {
        
        if (err) {

            res.send( {
                status: 0,
                error: error.toString(),
                data: []
            } );

            return;
        }

        var headers = [ 'voltage', 'voltagemin', 'voltagemax', 'current', 'currentmin', 'currentmax' ];
        var data = {};
        var time = [];

        header.map( function( val ) {
            data[ val ] = [];
        } );

        for( var i = 0, l = results[ 0 ].length; i < l; i ++ ) {

            var time = new Date( results[ 0 ][ i ].time );
            if( i == 0 ) {
                var time0 = time.getTime();
            }

            time.push( ( time.getTime() - time0 ) / 3600000 )

            headers.map( function( head ) {
                data[ head ].push( results[ 0 ][ i ][ head ])
            } );
        }

        res.send( {

            status: 1,
            error: false,
            data: data

        } );
    } );
} );




function restartServer() {

    app.listen(3001, function () {
      console.log('InfluxDB client running');
    });
}


function reset() {
    client = influx( configInfluxDb )
}

function resetServer() {
    // Need to reset the app here
}

exports.setConfig = function( config, resetClient ) {
    
    exports.setHost( config.host, false );
    exports.setUsername( config.username, false );
    exports.setPassword( config.password, false );
    exports.setPort( config.port, false );
    exports.setDB( config.db, false );
    //exports.setServerPort( config.server_port, false );
    
    configInfluxDb = config;

    if( resetClient ) {
        reset();
    }
}

exports.getConfig = function() {
    return configInfluxDb;
}

exports.setHost = function( host, resetClient ) {
    configInfluxDb.host = host;

    if( resetClient ) {
        reset();
    }
}

exports.setUsername = function( username, resetClient ) {
    configInfluxDb.username = username;

    if( resetClient ) {
        reset();
    }
}

exports.setPassword = function( password, resetClient ) {
    configInfluxDb.password = password;

    if( resetClient ) {
        reset();
    }
}

exports.setPort = function( port, resetClient ) {
    configInfluxDb.port = port;

    if( resetClient ) {
        reset();
    }
}

exports.setDB = function( db, resetClient ) {
    configInfluxDb.database = db;

    if( resetClient ) {
        reset();
    }
}

exports.setServerPort = function( port, resetClient ) {
    serverPort = port;

    if( resetClient ) {
        reset();
    }
}


exports.restartClient = function() {
    reset();
}

exports.restartServer = function() {
    restartServer();
}
