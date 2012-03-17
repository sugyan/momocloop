/**
 * Module dependencies.
 */

var express = require('express');
var app = module.exports = express.createServer();

var util = require('./util');
var routes = require('../routes');

// Configuration

app.configure(function () {
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
        secret: process.env.npm_package_config__http_session_secret || 'dummy',
        store: util.getRedisStore(process.env.npm_package_config__connect_redis_url || 'http://localhost:6379')
    }));
    app.use(express['static'](__dirname + '/../public'));
    app.use(routes.middleware.twitter);
    app.use(app.router);
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

// Helpers

app.helpers({
    twitter_api_key: process.env.npm_package_config__twitter_consumer_key
});
app.dynamicHelpers({
    session: function (req, res) {
        return req.session;
    }
});

// Routes

app.get('/', routes.index);
app.get('/live', routes.live);
app.get('/talk', routes.talk);
app.get('/signin',  routes.signin);
app.get('/signout', routes.signout);
app.get('/api/program', routes.api.program);
app.get('/settings', routes.settings);
