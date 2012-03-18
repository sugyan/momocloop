/**
 * Module dependencies.
 */

var sio   = require('socket.io');
var utils = require('express/node_modules/connect/lib/utils');

var util = require('./util');

exports.listen = function (app) {
    var store = util.getRedisStore(process.env.npm_package_config__connect_redis_url || 'http://localhost:6379');
    var redis_url = process.env.npm_package_config__redis_url || 'http://localhost:6379';
    var io = sio.listen(app);
    // connections
    var connection = io.of('/connection');
    connection.on('connection', function (socket) {
        var room;
        var emitConnection = function (myself) {
            var data = connection.clients('live').length;
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
            var redisClient = util.getRedisClient(redis_url);
            redisClient.lrange('comments' + room, 0, 19, function (err, results) {
                var current = new Date().getTime();
                redisClient.quit();
                if (err) {
                    console.error(err);
                    return;
                }
                results.reverse().forEach(function (e) {
                    var obj = JSON.parse(e);
                    if (current - obj.date < 1000 * 60 * 60) {
                        socket.volatile.json.emit('comment', obj);
                    }
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
            var redisClient = util.getRedisClient(redis_url);
            var key = 'comments' + room;
            redisClient.lpush(key, JSON.stringify(send), function (err) {
                if (err) {
                    console.error(err);
                }
                redisClient.ltrim(key, 0, 19, function (err) {
                    redisClient.quit();
                    if (err) {
                        console.error(err);
                    }
                });
            });
        });
        // call
        socket.on('call', function (data) {
            socket.broadcast.to(room).volatile.emit('call', data);
        });
    });
};
