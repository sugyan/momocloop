var model = require('./model');
var sio = require('socket.io');

exports.listen = function (app) {
    var io = sio.listen(app);
    var notifyConnection = function () {
        process.nextTick(function () {
            io.sockets.json.emit('connection', io.of().clients().length);
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
            var sid = utils.parseCookie(cookie)['connect.sid'];
            model.sessionStore.get(sid, function (err, session) {
                if (err) {
                    callback(err);
                }
                else {
                    handshakeData.session = session;
                    callback(null, true);
                }
            });
        });
    });
    io.sockets.on('connection', function (socket) {
        var user = socket.handshake.session.user;
        var name = user ? '@' + user.screen_name : '#' + socket.id.substr(0, 5);
        // your name
        socket.emit('name', name);
        // TODO: past comments
        // broadcast connection info
        notifyConnection();
        // event handler
        socket.on('comment', function (data) {
            var send = {
                date: new Date().getTime(),
                name: name,
                text: data
            };
            socket.broadcast.json.emit('comment', send);
        });
        socket.on('disconnect', notifyConnection);
    });
};
