var container = [];

exports.listen = function (app) {
    var io = require('socket.io').listen(app);
    io.set('browser client minification', true);
    io.sockets.on('connection', function (socket) {
        container.forEach(function (e) {
            socket.emit('comment', e);
        });
        var name = '#' + socket.id.substr(0, 5);
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
    });
};
