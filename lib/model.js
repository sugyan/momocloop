var mongodb = require('mongodb');

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
