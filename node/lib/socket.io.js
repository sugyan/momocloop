exports.listen = function (app) {
    var io = require('socket.io').listen(app);
    io.set('browser client minification', true);
    io.sockets.on('connection', function (socket) {
        console.log('connection');
    });
};
