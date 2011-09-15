var async = require('async');
var mongodb = require('mongodb');
var auth;
var server = new mongodb.Server(
    process.env.npm_package_config__mongodb_host,
    process.env.npm_package_config__mongodb_port,
    {}
);
if (process.env.npm_package_config__mongodb_username && process.env.npm_package_config__mongodb_password) {
    auth = {
        username: process.env.npm_package_config__mongodb_username,
        password: process.env.npm_package_config__mongodb_password
    };
}
db = new mongodb.Db(process.env.npm_package_config__mongodb_dbname, server);

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

db.open(function (err, client) {
    if (err) { throw err; }
    if (auth) {
        client.authenticate(auth.username, auth.password, function (err, result) {
            if (err) { throw err; }
            if (! result) { throw 'auth fails'; }
            ensureIndex();
        });
    } else {
        ensureIndex();
    }
});
