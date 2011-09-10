var mongodb = require('mongodb');
var mongoStore = require('connect-mongodb');

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

exports.store = store;
