var qs = require('qs');
var http = require('http');
var model = require('./model');

function isLiveRecord(vid) {
    var lives = require('./../config/settings').live;
    return lives[String(vid)] ? true : false;
}

var Program = module.exports = function (config) {
    this.db = new model.Db(config.mongo || {
        host: config.host,
        port: config.port,
        dbname: config.dbname,
        username: config.username,
        password: config.password
    });
    this.api = {
        endpoint: config.api.endpoint || {
            host: 'api.ustream.tv',
            port: 80,
            path: '/json/channel/momoclotv/listAllVideos'
        },
        key: config.api.key || ''
    };
};

Program.prototype.open = function (callback) {
    var self = this;
    self.db.open(function (err) {
        if (err) { callback(err); }
        self.db.collection('program', function (err, collection) {
            if (err) { callback(err); }
            self.collection = collection;
            callback();
        });
    });
};

Program.prototype.close = function (callback) {
    this.db.close(callback);
};

Program.prototype.getCurrent = function (type, now, callback) {
    if (typeof now === 'function') {
        callback = now;
        now = new Date();
    }
    if (type !== 'live' && type !== 'talk') {
        callback('invalid type');
    }
    var self = this;
    var check = function (data) {
        if (data.started) {
            // finished ?
            if (now > new Date(data.started + data.lengthInSecond * 1000)) {
                data.finished = true;
                self.collection.update({
                    _id: data._id
                }, data, {}, function (err) {
                    self.getCurrent(type, callback);
                });
            }
            else {
                callback(null, data);
            }
        }
        else {
            // start!
            data.started = now.getTime();
            self.collection.findAndModify({
                _id: data._id
            }, [], data, {
                'new': true
            }, function (err, data) {
                if (err) { callback(err); }
                callback(null, data);
                // tweet
                if (process.env.npm_package_config__twitter_access_token && process.env.npm_package_config__twitter_access_token_secret) {
                    var twitter = new (require('oauth')).OAuth(
                        'https://api.twitter.com/oauth/request_token',
                        'https://api.twitter.com/oauth/access_token',
                        process.env.npm_package_config__twitter_consumer_key,
                        process.env.npm_package_config__twitter_consumer_secret,
                        '1.0', null, 'HMAC-SHA1'
                    );
                    twitter.post(
                        'https://api.twitter.com/1/statuses/update.json',
                        process.env.npm_package_config__twitter_access_token,
                        process.env.npm_package_config__twitter_access_token_secret,
                        { status: '"' + data.title + '" の再生を開始しました #momocloop http://momoclo.no.de/' + data.type },
                        function (err, data) {
                            if (err) { console.error(err); }
                            console.log(JSON.parse(data));
                        }
                    );
                }
            });
        }
    };
    self.collection.find({
        type: type,
        finished: null
    }).toArray(function (err, docs) {
        if (err) { callback(err); }
        if (docs.length > 0) {
            check(docs[0]);
        }
        else {
            self.setPrograms(type, function (err) {
                if (err) { callback(err); }
                self.getCurrent(type, callback);
            });
        }
    });
};

Program.prototype.setPrograms = function (type, callback) {
    var self = this;
    self.getRecords(function (err, data) {
        if (err) { callback(err); }
        var shuffled = (function () {
            var candidates = data.results.filter(function (e) {
                // live or talk ?
                return (type !== 'live') ^ isLiveRecord(e.id);
            });
            var length = candidates.length;
            var result = [];
            while (length) {
                result.push(candidates.splice(Math.floor(Math.random() * length--), 1)[0]);
            }
            return result;
        }());
        self.collection.find({
            type: type,
            finished: null
        }).toArray(function (err, docs) {
            if (err) { callback(err); }
            var selected = shuffled.pop();
            var data = {};
            ['id', 'title', 'description', 'createdAt', 'lengthInSecond', 'url'].forEach(function (e) {
                data[e] = selected[e];
            });
            data.image1 = selected.imageUrl.small;
            data.image2 = selected.imageUrl.medium;
            data.createdAt = new Date(selected.createdAt);
            data.type = (type === 'live') ? 'live' : 'talk';
            self.collection.insert(data, function (err, objects) {
                if (err) { callback(err); }
                callback();
            });
        });
    });
};

Program.prototype.getRecords = function (callback) {
    var self = this;
    var query = qs.stringify({
        key: self.api.key,
        limit: '50'
    });
    var req = http.get({
        host: self.api.endpoint.host,
        port: self.api.endpoint.port,
        path: self.api.endpoint.path + '?' + query
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
