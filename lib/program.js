var qs = require('qs');
var url = require('url');
var http = require('http');
var redis = require('redis');

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
    this.createRedisClient = function () {
        var parsed_url  = url.parse(config.redis || 'redis://127.0.0.1:6379');
        var parsed_auth = (parsed_url.auth || '').split(':');
        var client = redis.createClient(parsed_url.port, parsed_url.hostname);
        if (parsed_auth.length > 1) {
            client.auth(parsed_auth[1], function (err) {
                if (err) {
                    throw err;
                }
            });
        }
        return client;
    };
};

Program.prototype.getPrograms = function (type, callback) {
    if (! this.supported_type[type]) {
        throw new Error('invalid type');
    }
    var self = this;
    var key = [self.key_prefix, type].join('-');

    var update_started = function (data) {
        var client = self.createRedisClient();
        data[0].started = new Date();
        client.lset(key, 0, JSON.stringify(data[0]), function (err, result) {
            client.quit();
            if (err) {
                callback(err);
                return;
            }
            self.getPrograms(type, callback);
        });
    };
    var check_started = function (data) {
        var started = new Date(data[0].started);
        data[0].started = started.getTime();
        if (new Date().getTime() > started.getTime() + data[0].lengthInSecond * 1000) {
            var client = self.createRedisClient();
            client.lpop(key, function (err, data) {
                client.quit();
                if (err) {
                    callback(err);
                    return;
                }
                self.getPrograms(type, callback);
            });
        } else {
            callback(null, data);
        }
    };
    var check_and_start = function (err, data) {
        if (err) {
            callback(err);
            return;
        }

        var results = data.map(function (e) {
            return JSON.parse(e);
        });
        if (results[0].started) {
            check_started(results);
        } else {
            update_started(results);
        }
    };

    var client = self.createRedisClient();
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
        var key = [self.key_prefix, type].join('-');

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
