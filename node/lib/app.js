/**
 * Module dependencies.
 */

var express = require('express');
var app = module.exports = express.createServer();

// Configuration

app.configure(function () {
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({ secret: 'your secret here' }));
    app.use(app.router);
    app.use(express['static'](__dirname + '/../public'));
});

app.configure('development', function () {
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});

app.configure('production', function () {
    app.use(express.errorHandler());
});

// Routes

app.get('/', function (req, res) {
    res.render('index', {
        title: 'momoclo'
    });
});

app.get('/api/program', function (req, res) {
    // FIXME:
    var length = 2 * 3600 + 36 * 60 + 35;
    var now = new Date();
    var start = new Date(2011, 8, 4, 16);
    var data = {
        vid: '15776910',
        seek: (now - start) / 1000 / length
    };
    res.end(JSON.stringify(data));
});
