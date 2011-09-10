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
        console.log('mongoStore connected.');
    });
}
else {
    (function () {
        var MemoryStore = (function () {
            var path = require('path');
            var expressPath = require.resolve('express');
            var utilsPath = path.join(path.dirname(expressPath), 'node_modules', 'connect', 'lib', 'middleware', 'session', 'memory');
            return require(utilsPath);
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
    if (config.dbname) {
        this.db = new mongodb.Db(config.dbname, server);
    }
}

Db.prototype.collection = function (collection, callback) {
    var self = this;
    if (self.client) {
        self.client.collection(collection, callback);
    }
    else {
        self.db.open(function (err, client) {
            if (err) { callback(err); }
            if (self.auth) {
                client.authenticate(self.auth.username, self.auth.password, function (err, result) {
                    if (err) { callback(err); }
                    if (! result) { callback('auth fails'); }
                    self.client = client;
                    self.collection(collection, callback);
                });
            }
            else {
                self.client = client;
                self.collection(collection, callback);
            }
        });
    }
};

exports.Db = Db;
