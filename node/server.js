var app = require('./lib/app');

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

require('./lib/socket.io').listen(app);
