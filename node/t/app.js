var test = require('tap').test;
var app = require('../lib/app');

var port = 3333;                // FIXME

test('app', function (t) {
    app.on('listening', function () {
        t.ok(true, 'start');
        app.on('close', function () {
            t.ok(true, 'end');
            t.end();
        });
        app.close();
    });
    app.listen(port);
});
