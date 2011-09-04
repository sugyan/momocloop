exports.listen = function (app) {
    var io = require('socket.io').listen(app);
    io.set('browser client minification', true);
    io.sockets.on('connection', function (socket) {
        var name = '#' + socket.id.substr(0, 5);
        socket.on('comment', function (data) {
            socket.broadcast.json.emit('comment', {
                name: name,
                text: data
            });
        });
    });
};
