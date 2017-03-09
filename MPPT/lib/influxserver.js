var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var promise = require("bluebird");
var influx = require('influx')
var fs = require('fs');
var params = JSON.parse( fs.readFileSync( 'params.json' ) );
var util = require("./util");
var extend = require("extend");

var configInfluxDb = {
    host: 'influxdb.epfl.ch',
    username: 'lpi',
    password: 'lpi77',
    port: 88,
    database: 'lpi'
};

var client, client_1min, client_1hour;

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

    var cellName, data;

    if( ! client ) {
        //console.log( res );
        res.send( {
            status: 0,
            error: "No client connected"
        } );
        return;
    }


    var promises = [];

    function saveData( i, error ) {

        if( i == req.body.length ) {    // Done

            if( error ) {

                res.send( {
                    status: 0,
                    error: error
                } );
            } else {

                res.send( {
                    status: 1,
                    error: false
                } );

            }

            return;
        }


        var cellName = req.body[ i ].cellName;
        var data = req.body[ i ].data;

        data = data.map( ( el ) => {
            
            return { measurement: cellName, fields: el[ 0 ] };
        });

        client.writePoints( data ).then( ( err ) => {

            if (err) {
                console.log(err);
                saveData( i + 1, true );
                return;
            }

            saveData( i + 1, error );
        }) 

    }


    saveData( 0, false );


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

    let theClient = client;

    if( grouping >= 60 && grouping < 3600 ) {
        theClient = client_1min;
    } else if( grouping >= 3600 ) {
        theClient = client_1hour;
    }
//console.log( grouping, theClient );
    
    if( theClient != client ) {
        var paramMax = parameter + "_max";
        var paramMin = parameter + "_min";
        query = "SELECT MEAN(" + parameter + "_mean) AS mean, MAX(" + paramMax + ") AS max, MIN(" + paramMin + ") AS min FROM " + cellName + " WHERE ( time >= " + timeFrom + " AND time < " + timeTo+ " ) GROUP BY time(" + ( grouping ) + "s) FILL(none)";

    else    {
        query = "SELECT MEAN(" + parameter + ") AS mean, MAX(" + paramMax + ") AS max, MIN(" + paramMin + ") AS min FROM " + cellName + " WHERE ( time >= " + timeFrom + " AND time < " + timeTo+ " ) GROUP BY time(" + ( grouping ) + "s) FILL(none)";
    }


    theClient.query(query).then( results => {

        var dataMean = [],
            dataMinMax = [];

        for( var i = 0, l = results.length; i < l; i ++ ) {

            var time = new Date( results[ i ].time );

            if( results[ i ].mean > 3 || results[ i ].min > 3 || results[ i ].max > 3 ) {
                continue;
            }

            dataMean.push( time.getTime() );
            dataMean.push( results[ i ].mean );

            dataMinMax.push( time.getTime() );
            dataMinMax.push( results[ i ].min );
            dataMinMax.push( results[ i ].max );
        }


        res.send( {

            status: 1,
            error: false,
            data: {
                mean: dataMean,
                minmax: dataMinMax
            }
        } );
    }, error => {
        console.log( error );

        res.send( {
            status: 0,
            error: error.toString(),
            data: []
        } );
    } );
} );



app.get("/showMeasurements", function( req, res ) {

    /*function getFromTo( results, index ) {

        client.query("SELECT voltage,time FROM \"" + results[ index ].name + "\" ORDER BY time ASC limit 1; SELECT voltage,time FROM \"" + results[ index ].name + "\" ORDER BY time DESC limit 1;", function( err, res ) {

            if( err ) {

            } else {


                if( res[ 0 ][ 0 ] && res[0][0].time && res[1][0] && res[ 1 ][ 0 ].time ) {
                    results[ index ].from = new Date( res[ 0 ][ 0 ].voltage );
                    results[ index ].to = new Date( res[ 1 ][ 0 ].voltage );
                }

            }
            if( results.length == index + 1 ) {
                res.send( JSON.stringify( results ) );
            } else {
                getFromTo( results, index + 1 );
            }
        });
    }*/

    client.query("SHOW MEASUREMENTS").then( ( err, results ) => {

        res.send( JSON.stringify( results[ 0 ] ) );

    });
});




app.get("/export", function( req, res ) {

    if( ! client ) {

        res.send( JSON.stringify( {
            status: 0,
            error: "No client connected"
        } ) );
        return;
    }

    var cellName = req.body.measurement;
    var timing = req.body.grouping;



    client.query("SELECT voltage,time FROM \"" + cellName + "\" ORDER BY time ASC limit 1; SELECT voltage,time FROM \"" + cellName + "\" ORDER BY time DESC limit 1;" ).then( ( err, results ) => {

        var _from = results[ 0 ][ 0 ].time;
        var _to = results[ 1 ][ 0 ].time;

        var query = "SELECT mean(voltage) as voltage, max(voltagemax) as voltagemax, min(voltagemin) as voltagemin, mean(current) as current, max(currentmax) as currentmax, min(currentmin) as currentmin, mean(power) as power FROM \"" + cellName + "\" WHERE ( time < '" + _to + "' AND time > '" + _from + "' ) GROUP BY time(" + timing + "s) FILL(none)";

        client.query( query ).then( results => {

        
            var headers = [ 'voltage', 'voltagemin', 'voltagemax', 'current', 'currentmin', 'currentmax', 'power' ];
            var data = {};
            var time = [];

            headers.map( function( val ) {
                data[ val ] = [];
            } );

            data.time = time;

            for( var i = 0, l = results.length; i < l; i ++ ) {

                var timestamp = new Date( results[ i ].time );
                if( i == 0 ) {
                    var time0 = timestamp.getTime();
                }

                time.push( ( timestamp.getTime() - time0 ) / 3600000 )

                headers.map( function( head ) {
                    data[ head ].push( results[ i ][ head ])
                } );
            }

            res.send( JSON.stringify( {

                status: 1,
                error: false,
                data: data

            } ) );
        }, error => {

            res.send( JSON.stringify( {
                status: 0,
                error: err.toString(),
                query: query,
                data: []
            } ) );

            return;

        } );



    });


} );


function restartServer() {

    app.listen(3001, function () {
      console.log('InfluxDB client running');
    });
}


function reset() {
    client = new influx.InfluxDB( configInfluxDb );

    client_1min = new influx.InfluxDB( extend( configInfluxDb, { database: "lpi_downsampled_1min" } ) );
    client_1hour = new influx.InfluxDB( extend( configInfluxDb, { database: "lpi_downsampled_1h" } ) );
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
