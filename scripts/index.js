var url = require('url');
var async = require('async');
var mongodb = require('mongodb');
var model = require('./../lib/model');

var db = (function () {
    var parsed_url  = url.parse(process.env.npm_package_config__mongo_url || 'mongodb://127.0.0.1:27017/momocloop');
    var parsed_auth = parsed_url.auth ? parsed_url.auth.split(':') : null;
    var config = {
        host: parsed_url.hostname,
        port: parsed_url.port,
        dbname: parsed_url.pathname.substr(1)
    };
    if (parsed_auth) {
        config.username = parsed_auth[0];
        config.password = parsed_auth[1];
    }
    return new model.Db(config);
}());

function ensureIndex () {
    async.series([
        function (callback) {
            db.collection('comment', function (err, collection) {
                if (err) { callback(err); }
                collection.ensureIndex({ date: -1, room: 1 }, function (er, results) {
                    if (err) { callback(err); }
                    console.log(results);
                    callback();
                });
            });
        },
        function (callback) {
            db.collection('program', function (err, collection) {
                if (err) { callback(err); }
                collection.ensureIndex({ type: 1, finished: 1 }, function (er, results) {
                    if (err) { callback(err); }
                    console.log(results);
                    callback();
                });
            });
        }
    ], function (err, results) {
        if (err) { throw err; }
        db.close();
    });
}

db.open(function (err) {
    if (err) { throw err; }
    ensureIndex();
});
