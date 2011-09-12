var mongodb = require('mongodb');
var mongoStore = require('connect-mongodb');

// Session Store

var store;
if (process.env.npm_package_config__mongodb_host && process.env.npm_package_config__mongodb_port) {
    store = new mongoStore({
        server_config: new mongodb.Server(
            process.env.npm_package_config__mongodb_host,
            process.env.npm_package_config__mongodb_port
        ),
        dbname: process.env.npm_package_config__mongodb_dbname,
        username: process.env.npm_package_config__mongodb_username,
        password: process.env.npm_package_config__mongodb_password
    }, function (err) {
        if (err) { throw err; }
        console.log('mongoStore is ready');
    });
}
else {
    (function () {
        var MemoryStore = (function () {
            var path = require('path');
            var expressPath = require.resolve('express');
            var memoryPath = path.join(path.dirname(expressPath), 'node_modules', 'connect', 'lib', 'middleware', 'session', 'memory');
            return require(memoryPath);
        }());
        store = new MemoryStore();
    }());
}
exports.sessionStore = store;

// Database

function Db (config) {
    var server = new mongodb.Server(config.host, config.port, {});
    if (config.username && config.password) {
        this.auth = {
            username: config.username,
            password: config.password
        };
    }
    this.db = new mongodb.Db(config.dbname, server);
}

Db.prototype.open = function (callback) {
    var self = this;
    self.db.open(function (err, client) {
        if (err) { callback(err); }
        if (self.auth) {
            client.authenticate(self.auth.username, self.auth.password, function (err, result) {
                if (err) { callback(err); }
                if (! result) { callback('auth fails'); }
                callback();
            });
        }
        else {
            callback();
        }
    });
};

Db.prototype.collection = function (collection, callback) {
    var self = this;
    self.db.collection(collection, function (err, collection) {
        if (err) { callback(err); }
        callback(null, collection);
    });
};

Db.prototype.close = function (callback) {
    this.db.close(callback);
};

exports.Db = Db;
