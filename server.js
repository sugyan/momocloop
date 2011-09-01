var server = require('http').createServer(function (req, res) {
    require('data-section').get('html', function (err, data) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
});
var io = require('socket.io').listen(server);
io.sockets.on('connection', function (socket) {
    socket.on('ping', function (data) {
        socket.broadcast.json.emit('pong', {
            clients: Object.keys(io.sockets.clients()).length,
            data: data
        });
    });
});
server.listen(process.env.PORT || 3000);

/*__DATA__
@@ html
<!DOCTYPE html>
<html>
  <head>
    <title>test</title>
    <script type="text/javascript" src="/socket.io/socket.io.js"></script>
    <script type="text/javascript">
var start = new Date().getTime();
var socket = io.connect();
var ua = window.navigator.userAgent;
socket.on('pong', function (data) {
  var delay = new Date().getTime() - data.data.datetime;
  if (data.data.ua === ua) {
    console.log('pong: ' + delay + ' ms on ' + data.clients + ' clients');
  }
});
socket.on('connect', function () {
  console.log('connect: ' + (new Date().getTime() - start));
  setInterval(function () {
    socket.emit('ping', {
      datetime: new Date().getTime(),
      ua: ua
    });
  }, 1000);
});
    </script>
  </head>
  <body>
  </body>
</html>
__DATA__*/
