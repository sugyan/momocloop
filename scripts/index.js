var url = require('url');
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

db.open(function (err) {
    if (err) { throw err; }
    db.collection('comment', function (err, collection) {
        if (err) { callback(err); }
        collection.ensureIndex({ date: -1, room: 1 }, function (er, results) {
            if (err) { callback(err); }
            console.log(results);
            db.close();
        });
    });
});
