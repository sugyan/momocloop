var container = [];

exports.listen = function (app) {
    var io = require('socket.io').listen(app);
    io.set('browser client minification', true);
    io.sockets.on('connection', function (socket) {
        var name = '#' + socket.id.substr(0, 5);
        var notifyConnection = function () {
            process.nextTick(function () {
                io.sockets.json.emit('connection', io.of().clients().length);
            });
        };
        container.forEach(function (e) {
            socket.emit('comment', e);
        });
        socket.on('comment', function (data) {
            var send = {
                date: new Date().getTime(),
                name: name,
                text: data
            };
            socket.broadcast.json.emit('comment', send);
            container.push(send);
            while (container.length > 10) {
                container.shift();
            }
        });
        socket.on('disconnect', notifyConnection);
        notifyConnection();
    });
};
