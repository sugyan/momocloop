/**
 * Module dependencies.
 */

var qs = require('qs');
var http = require('http');

var util = require('./util');

var Program = module.exports = function (config) {
    this.lives = require('./../config/settings').live;
    this.key_prefix = 'program';
    this.supported_type = {
        'live': true,
        'talk': true
    };
    this.api = config.api || {
        host: 'api.ustream.tv',
        port: 80,
        path: '/json/channel/momoclotv/listAllVideos',
        key: ''
    };
    this.redis_url = config.redis || 'redis://127.0.0.1:6379';
};

Program.prototype.createRedisClient = function () {
    return util.getRedisClient(this.redis_url);
};

Program.prototype.getPrograms = function (type, callback) {
    if (! this.supported_type[type]) {
        throw new Error('invalid type');
    }
    var self = this;
    var key = [self.key_prefix, type].join('/');
    var client;

    var check_and_start = function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        var results = data.map(function (e) {
            return JSON.parse(e);
        });
        var client;

        if (results[0].started) {
            if (new Date().getTime() > results[0].started + results[0].lengthInSecond * 1000) {
                client = self.createRedisClient();
                client.lpop(key, function (err, data) {
                    client.quit();
                    if (err) {
                        callback(err);
                        return;
                    }
                    self.getPrograms(type, callback);
                });
            } else {
                callback(null, results);
            }
        } else {
            results[0].started = new Date().getTime();
            client = self.createRedisClient();
            client.lset(key, 0, JSON.stringify(results[0]), function (err, result) {
                client.quit();
                if (err) {
                    callback(err);
                    return;
                }
                self.getPrograms(type, callback);
            });
        }
    };

    client = self.createRedisClient();
    client.lrange(key, 0, 4, function (err, results) {
        client.quit();
        if (err) {
            callback(err);
            return;
        }
        if (results.length < 5) {
            self._getRecords(function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                self._generateProgram(type, data, check_and_start);
            });
        } else {
            check_and_start(null, results);
        }
    });
};

Program.prototype._getRecords = function (callback) {
    var self = this;
    var query = qs.stringify({
        key: self.api.key,
        limit: '50'
    });
    var req = http.get({
        host: self.api.host,
        port: self.api.port,
        path: self.api.path + '?' + query
    }, function (res) {
        var buffer = '';
        res.on('data', function (chunk) {
            buffer += chunk;
        });
        res.on('end', function () {
            callback(null, JSON.parse(buffer));
        });
    });
    req.on('error', callback);
};

Program.prototype._generateProgram = function (type, data, callback) {
    var self = this;
    if (! self.supported_type[type]) {
        throw new Error('invalid type');
    }

    var getUniqueList = function (candidates) {
        var client = self.createRedisClient();
        var key = [self.key_prefix, type].join('/');

        var checkDuplication = function (data) {
            var res = -1;
            var obj = {};
            data.forEach(function (e, i) {
                var id = JSON.parse(e).id;
                if (obj[id]) {
                    res = i;
                }
                obj[id] = true;
            });
            return res;
        };
        var challenge = function () {
            client.lrange(key, 0, 4, function (err, results) {
                if (err) {
                    callback(err);
                    return;
                }
                if (results.length < 5) {
                    // push and retry
                    var data = candidates.shift();
                    candidates.push(data);
                    client.rpush(key, JSON.stringify(data), function (err, result) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        challenge();
                    });
                } else {
                    var duplication = checkDuplication(results);
                    if (duplication === -1) {
                        client.quit();
                        callback(null, results);
                    } else {
                        client.ltrim(key, 0, duplication - 1, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            challenge();
                        });
                    }
                }
            });
        };
        challenge();
    };

    // filtering and shuffle
    var candidates = (function () {
        var elem = function (data) {
            var obj = {};
            ['id', 'title', 'description', 'createdAt', 'lengthInSecond', 'url'].forEach(function (e) {
                obj[e] = data[e];
            });
            obj.image1 = data.imageUrl.small;
            obj.image2 = data.imageUrl.medium;
            obj.createdAt = new Date(data.createdAt);
            obj.type = (type === 'live') ? 'live' : 'talk';
            return obj;
        };
        var filtered = data.results.filter(function (e) {
            return (type !== 'live') ^ (self.lives[String(e.id)] ? true : false);
        });
        var len = filtered.length;
        var res = [];
        while (len) {
            res.push(elem(filtered.splice(Math.floor(Math.random() * len--), 1)[0]));
        }
        return res;
    }());
    getUniqueList(candidates);
};
