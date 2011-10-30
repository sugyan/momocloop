/**
 * Module dependencies.
 */

var oauth = require('oauth');
var redis = require('redis');
var express = require('express');
var app = module.exports = express.createServer();

var util    = require('./util');
var Program = require('./program');

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
    app.use(function (req, res, next) {
        if (req.session && req.session.user && ! req.session.user.name) {
            // user info
            app.twitter.get(
                'http://api.twitter.com/1/users/show.json?id=' + req.session.user.user_id,
                req.session.user.auth.token, req.session.user.auth.token_secret, function (err, data) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    // save to redis
                    var obj = JSON.parse(data);
                    var user_data = {};
                    ['id', 'name', 'screen_name', 'description', 'profile_image_url', 'location', 'url', 'lang', 'protected']
                        .forEach(function(e) {
                            user_data[e] = obj[e];
                        });
                    var user = req.session.user;
                    user.image = user_data.profile_image_url;
                    user.name  = user_data.name;
                    req.session.user = user;

                    var redisClient = util.getRedisClient(process.env.npm_package_config__redis_url || 'redis://127.0.0.1:6379');
                    redisClient.set(['user', user_data.id].join('/'), JSON.stringify(user_data), function (err) {
                        redisClient.quit();
                        if (err) {
                            console.error(err);
                        }
                        next();
                    });
                }
            );
        }
        else {
            next();
        }
    });
    app.use(app.router);

    // additional methods
    app.twitter = new oauth.OAuth(
        'https://api.twitter.com/oauth/request_token',
        'https://api.twitter.com/oauth/access_token',
        process.env.npm_package_config__twitter_consumer_key,
        process.env.npm_package_config__twitter_consumer_secret,
        '1.0', null, 'HMAC-SHA1'
    );
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

app.get('/', function (req, res) {
    res.render('index', { isTop: true });
});

app.get('/live', function (req, res) {
    res.render('play', {
        title: 'Live! - '
    });
});

app.get('/talk', function (req, res) {
    res.render('play', {
        title: 'Talk! - '
    });
});

app.get('/signin', function (req, res) {
    if (req.query.oauth_token && req.query.oauth_verifier) {
        app.twitter.getOAuthAccessToken(
            req.query.oauth_token,
            req.query.oauth_verifier,
            function (err, token, token_secret, results) {
                if (err) {
                    res.send(err.data, err.statusCode);
                    return;
                }
                results.auth = {
                    token: token,
                    token_secret: token_secret
                };
                req.session.user = results;
                res.redirect('/');
            }
        );
    }
    else {
        app.twitter.getOAuthRequestToken(function (err, token, token_secret, results) {
            if (err) {
                res.send(err.data, err.statusCode);
                return;
            }
            res.redirect(app.twitter.signUrl(
                'https://api.twitter.com/oauth/authorize', token, token_secret
            ));
        });
    }
});

app.get('/signout', function (req, res) {
    req.session.destroy();
    res.redirect('/');
});

app.get('/settings', function (req, res) {
    res.render('settings');
});

app.get('/api/program', function (req, res) {
    var type = req.param('type') === 'live' ? 'live' : 'talk';
    var program = new Program({
        redis: process.env.npm_package_config__redis_url || 'redis://127.0.0.1:6379'
    });
    program.getPrograms(type, function (err, data) {
        if (err) {
            res.send(err.message, 500);
        } else {
            res.json(data);
        }
    });
});
