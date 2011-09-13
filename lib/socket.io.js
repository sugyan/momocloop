var model = require('./model');
var sio = require('socket.io');
var utils = (function () {
    var path = require('path');
    var expressPath = require.resolve('express');
    var utilsPath = path.join(path.dirname(expressPath), 'node_modules', 'connect', 'lib', 'utils');
    return require(utilsPath);
}());

exports.listen = function (app) {
    var io = sio.listen(app);

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
            model.sessionStore.get(sid, function (err, session) {
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
        });
        // comment
        socket.on('comment', function (data) {
            var send = {
                date: new Date().getTime(),
                name: name,
                text: data
            };
            socket.broadcast.to(room).json.emit('comment', send);
        });
    });
};
