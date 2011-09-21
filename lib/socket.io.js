var model = require('./model');
var sio = require('socket.io');
var utils = (function () {
    var path = require('path');
    var expressPath = require.resolve('express');
    var utilsPath = path.join(path.dirname(expressPath), 'node_modules', 'connect', 'lib', 'utils');
    return require(utilsPath);
}());

exports.listen = function (app) {
    var store = (function () {
        var url = require('url');
        var RedisStore  = require('connect-redis')(require('express'));
        var parsed_url  = url.parse(process.env.npm_package_config__redis_url || 'http://localhost:6379');
        var parsed_auth = (parsed_url.auth || '').split(':');
        return new RedisStore({
            host: parsed_url.hostname,
            port: parsed_url.port,
            pass: parsed_auth[1]
        });
    }());

    var io = sio.listen(app);
    var db = new model.Db({
        host: process.env.npm_package_config__mongodb_host,
        port: process.env.npm_package_config__mongodb_port,
        dbname: process.env.npm_package_config__mongodb_dbname,
        username: process.env.npm_package_config__mongodb_username,
        password: process.env.npm_package_config__mongodb_password
    });
    db.open(function (err) {
        if (err) { throw err; }
        console.log('db for socket.io is ready');
    });

    // connections
    var connection = io.of('/connection');
    connection.on('connection', function (socket) {
        var room;
        var emitConnection = function (myself) {
            var data = {
                live: connection.clients('live').length,
                talk: connection.clients('talk').length
            };
            if (myself) {
                socket.json.emit('connection', data);
            } else {
                connection.json.emit('connection', data);
            }
        };
        socket.on('disconnect', function () {
            if (room) {
                process.nextTick(emitConnection);
            }
        });
        socket.on('join', function (path) {
            room = path.replace(/^\//, '');
            if (room) {
                socket.join(room);
            }
            emitConnection(room ? false : true);
        });
    });

    // player
    var player; player = io.of('/player');
    player.authorization(function (handshakeData, callback) {
        var cookie = handshakeData.headers.cookie;
        try {
            var sid = utils.parseCookie(cookie)['connect.sid'];
            store.get(sid, function (err, session) {
                if (err) { callback(err); }
                handshakeData.session = session;
                callback(null, true);
            });
        } catch (e) {
            console.error([e.type, e.message].join(':'));
            handshakeData.session = {};
            callback(null, true);
        }
    });
    player.on('connection', function (socket) {
        var room;
        var user = socket.handshake.session.user;
        // your name
        var name = user ? '@' + user.screen_name : '#' + socket.id.substr(0, 5);
        socket.emit('name', name);
        // room
        socket.on('join', function (path) {
            socket.join(room = path);
            db.collection('comment', function (err, collection) {
                if (err) {
                    console.error(err);
                    return;
                }
                collection.find({ room: room }).sort({ date: -1 }).limit(30).toArray(function (err, results) {
                    results.reverse().forEach(function (e) {
                        delete e._id;
                        socket.volatile.json.emit('comment', e);
                    });
                });
            });
        });
        // comment
        socket.on('comment', function (data) {
            var send = {
                date: new Date().getTime(),
                name: name,
                text: data.text
            };
            socket.broadcast.to(room).json.emit('comment', send);
            send.room = room;
            send.vid  = data.vid;
            send.time = data.time;
            db.collection('comment', function (err, collection) {
                if (err) {
                    console.error(err);
                    return;
                }
                collection.insert(send);
            });
        });
        // call
        socket.on('call', function (data) {
            socket.broadcast.to(room).volatile.emit('call', data);
        });
    });
};
