/**
 * Module dependencies.
 */

var config = require('./../config/default');
var Program = require('./program');
var _ = require('underscore');
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

var program = new Program(config);

// Routes

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/api/program', function (req, res) {
    // FIXME:
    program.getCurrent(function (err, data) {
        if (err) { throw err; }
        var obj = _.clone(data);
        var now = new Date();
        obj.seek = (now - obj.start) / obj.length;
        res.end(JSON.stringify(obj));
    });
});
