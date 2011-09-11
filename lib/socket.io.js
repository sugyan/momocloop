var model = require('./model');
var sio = require('socket.io');
var _ = require('underscore');

exports.listen = function (app) {
    var io = sio.listen(app);
    var notifyConnection = function () {
        process.nextTick(function () {
            var data = _.clone(io.rooms);
            delete data[''];
            io.sockets.json.emit('connection', data);
        });
    };
    io.configure(function () {
        var utils = (function () {
            var path = require('path');
            var expressPath = require.resolve('express');
            var utilsPath = path.join(path.dirname(expressPath), 'node_modules', 'connect', 'lib', 'utils');
            return require(utilsPath);
        }());
        io.set('browser client minification', true);
        io.set('authorization', function (handshakeData, callback) {
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
    });
    io.sockets.on('connection', function (socket) {
        var room;
        var user = socket.handshake.session.user;
        var name = user ? '@' + user.screen_name : '#' + socket.id.substr(0, 5);
        // your name
        socket.emit('name', name);
        // TODO: past comments
        // event handler
        socket.on('join', function (path) {
            room = path.replace(/^\//, '');
            if (room.length > 0) {
                socket.join(room);
            }
            notifyConnection();
        });
        socket.on('comment', function (data) {
            var send = {
                date: new Date().getTime(),
                name: name,
                text: data
            };
            socket.broadcast.to(room).json.emit('comment', send);
        });
        socket.on('disconnect', notifyConnection);
    });
};
