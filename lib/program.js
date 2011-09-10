var qs = require('qs');
var http = require('http');
var model = require('./model');
var Db = new model.Db({
    host: process.env.npm_package_config__mongodb_host,
    port: process.env.npm_package_config__mongodb_port,
    dbname: process.env.npm_package_config__mongodb_dbname,
    username: process.env.npm_package_config__mongodb_username,
    password: process.env.npm_package_config__mongodb_password
});

function isLiveRecord(vid) {
    var lives = require('./../config/settings').live;
    return lives[String(vid)] ? true : false;
}

function getRecords (callback) {
    var query = qs.stringify({
        key: process.env.npm_package_config__ustream_key || '',
        limit: '50'
    });
    // TODO: error handling
    http.get({
        host: 'api.ustream.tv',
        path: '/json/channel/momoclotv/listAllVideos?' + query
    }, function (res) {
        var buffer = '';
        res.on('data', function (chunk) {
            buffer += chunk;
        });
        res.on('end', function () {
            callback(null, JSON.parse(buffer));
        });
    });
}

function setPrograms (type, callback) {
    getRecords(function (err, data) {
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
        Db.collection('program', function (err, collection) {
            // TODO
            collection.find({}).toArray(function (err, docs) {
                if (err) { callback(err); }
                var selected = shuffled.pop();
                var data = {};
                ['id', 'title', 'description', 'createdAt', 'lengthInSecond', 'url'].forEach(function (e) {
                    data[e] = selected[e];
                });
                data.image1 = selected.imageUrl.small;
                data.image2 = selected.imageUrl.medium;
                data.type = (type === 'live') ? 'live' : 'talk';
                collection.insert(data, function (err, objects) {
                    if (err) { callback(err); }
                    callback(null, objects);
                });
            });
        });
    });
}

var getCurrent = exports.getCurrent = function (type, callback) {
    if (type !== 'live' && type !== 'talk') {
        callback('invalid type');
    }
    Db.collection('program', function (err, collection) {
        if (err) { callback(err); }
        var check = function (data) {
            var now = new Date();
            if (data.started) {
                // finished ?
                if (now > new Date(data.started + data.lengthInSecond * 1000)) {
                    data.finished = true;
                    collection.update({
                        _id: data._id
                    }, data, {}, function (err) {
                        getCurrent(type, callback);
                    });
                }
                else {
                    callback(null, data);
                }
            }
            else {
                // start!
                data.started = now.getTime();
                collection.findAndModify({
                    _id: data._id
                }, [], data, {
                    'new': true
                }, function (err, data) {
                    if (err) { callback(err); }
                    callback(null, data);
                });
            }
        };
        collection.find({
            type: type,
            finished: null
        }).toArray(function (err, docs) {
            if (err) { callback(err); }
            if (docs.length > 0) {
                check(docs[0]);
            }
            else {
                setPrograms(type, function (err, data) {
                    if (err) { callback(err); }
                    check(data[0]);
                });
            }
        });
    });
};
