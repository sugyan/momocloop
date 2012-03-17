var qs   = require('qs');
var http = require('http');
var util = require('./util');

var Program = module.exports = function (config) {
    this.lives = config.lives || require('./../config/settings').live;
    this.num = 2;
    this.key = 'program';
    this.api = config.api || {
        host: 'api.ustream.tv',
        port: 80,
        path: '/json/channel/momoclotv/listAllVideos',
        key: ''
    };
    this.redis_url = config.redis || 'redis://127.0.0.1:6379';
};

Program.prototype.getPrograms = function (callback) {
    var self = this;
    var client;

    var check_and_start = function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        var client;
        var results = data.map(function (e) {
            return JSON.parse(e);
        });

        if (results[0].started) {
            if (new Date().getTime() > results[0].started + results[0].lengthInSecond * 1000) {
                client = util.getRedisClient(self.redis_url);
                client.lpop(self.key, function (err, data) {
                    client.quit();
                    if (err) {
                        callback(err);
                        return;
                    }
                    self.getPrograms(callback);
                });
            } else {
                callback(null, results);
            }
        } else {
            results[0].started = new Date().getTime();
            client = util.getRedisClient(self.redis_url);
            client.lset(self.key, 0, JSON.stringify(results[0]), function (err, result) {
                client.quit();
                if (err) {
                    callback(err);
                    return;
                }
                self.getPrograms(callback);
            });
        }
    };

    client = util.getRedisClient(self.redis_url);
    client.lrange(self.key, 0, self.num - 1, function (err, results) {
        client.quit();
        if (err) {
            callback(err);
            return;
        }
        if (results.length < self.num) {
            self._getRecords(function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                self._generateProgram(data, check_and_start);
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
            if (res.statusCode === 200) {
                callback(null, JSON.parse(buffer));
            } else {
                callback(new Error(buffer));
            }
        });
    });
    req.on('error', callback);
};

Program.prototype._generateProgram = function (data, callback) {
    var self = this;

    var getUniqueList = function (candidates) {
        var client = util.getRedisClient(self.redis_url);

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
            client.lrange(self.key, 0, 1, function (err, results) {
                if (err) {
                    callback(err);
                    return;
                }
                if (results.length < 2) {
                    // push and retry
                    var data = candidates.shift();
                    candidates.push(data);
                    client.rpush(self.key, JSON.stringify(data), function (err, result) {
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
                        client.ltrim(self.key, 0, duplication - 1, function (err) {
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
            return obj;
        };
        var filtered = data.results.filter(function (e) {
            return self.lives[String(e.id)] ? true : false;
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
