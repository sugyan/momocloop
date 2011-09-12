var test = require('tap').test;
var _ = require('underscore');
var async = require('async');
var model = require('../lib/model');

var port = 3335;                // FIXME

var json = '{"id":15081480,"name":"すぎゃーん","screen_name":"sugyan","description":"いま会えるプログラマ、週末エンジニア ももいろすぎゃーんZ！ 仙台出身。 PerlとかJavaScriptとか。 @zenra_bot, #iconguruguru, #livecoder など。 ももクロ好き。","profile_image_url":"http://a0.twimg.com/profile_images/1386920992/icon-large_normal.png","location":"神奈川県鎌倉市","url":"http://sugyan.com/","lang":"en","protected":false}';
var data = JSON.parse(json);
var db = new model.Db({
    host: '127.0.0.1',
    port: port,
    dbname: 'test'
});

var mongod;
test('update(upsert)', function (t) {
    t.on('end', function () {
        if (mongod) { mongod.kill(); }
    });
    async.series([
        function (callback) {
            mongod = require('child_process').spawn('mongod', [
                '--dbpath', 't/db',
                '--port', port
            ]);
            mongod.stdout.on('data', function (data) {
                var stdout = data.toString();
                if (RegExp('exception').test(stdout)) {
                    callback('mongod error');
                }
                else if (RegExp('waiting for connections on port ' + port).test(stdout)) {
                    callback();
                }
            });
        },
        function (callback) {
            db.open(callback);
        },
        function (callback) {
            // all remove
            db.collection('user', function (err, collection) {
                if (err) { callback(err); }
                collection.remove({}, function (err) {
                    if (err) { callback(err); }
                    collection.count(function (err, count) {
                        if (err) { callback(err); }
                        t.equal(count, 0, 'all removed');
                        callback();
                    });
                });
            });
        },
        function (callback) {
            // update
            db.collection('user', function (err, collection) {
                if (err) { callback(err); }
                var obj = _.clone(data);
                obj._id = String(obj.id);
                collection.update({
                    _id: obj._id
                }, obj, { upsert: true }, function (err) {
                    if (err) { callback(err); }
                    callback();
                });
            });
        },
        function (callback) {
            // check count
            db.collection('user', function (err, collection) {
                if (err) { callback(err); }
                collection.count(function (err, count) {
                    if (err) { callback(err); }
                    t.equal(count, 1, '1 user created');
                    callback();
                });
            });
        },
        function (callback) {
            // find
            db.collection('user', function (err, collection) {
                if (err) { callback(err); }
                collection.findOne({ _id: String(data.id) }, function (err, data) {
                    if (err) { callback(err); }
                    t.ok(data, 'found');
                    callback();
                });
            });
        },
        function (callback) {
            // change screen_name
            db.collection('user', function (err, collection) {
                if (err) { callback(err); }
                var obj = _.clone(data);
                obj.screen_name = 'sugyanZ';
                obj._id = String(obj.id);
                collection.update({
                    _id: obj._id
                }, obj, { upsert: true }, function (err) {
                    if (err) { callback(err); }
                    callback();
                });
            });
        },
        function (callback) {
            // check count
            db.collection('user', function (err, collection) {
                if (err) { callback(err); }
                collection.count(function (err, count) {
                    if (err) { callback(err); }
                    t.equal(count, 1, '1 user found');
                    callback();
                });
            });
        },
        function (callback) {
            // check name
            db.collection('user', function (err, collection) {
                collection.findOne({ _id: String(data.id) }, function (err, data) {
                    if (err) { callback(err); }
                    t.equal(data.screen_name, 'sugyanZ', 'updated');
                    callback();
                });
            });
        }
    ], function (err, results) {
        if (err) {
            console.error(err);
        }
        mongod.kill();
        t.equal(err, undefined, 'no errors');
        t.end();
    });

    process.on('uncaughtException', function (err) {
        console.error(err.type + ': ', err.message);
        t.ok(! err, 'no uncaughtException');
        t.end();
    });
});
