/**
 * Module dependencies.
 */

var url     = require('url');
var oauth   = require('oauth');
var express = require('express');
var app = module.exports = express.createServer();

var model   = require('./model');
var Program = require('./program');
var db;

// Configuration

app.configure(function () {
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
        secret: process.env.npm_package_config__http_session_secret || 'dummy',
        store: (function () {
            var RedisStore = require('connect-redis')(express);
            var parsed_url  = url.parse(process.env.npm_package_config__redis_url || 'http://localhost:6379');
            var parsed_auth = (parsed_url.auth || '').split(':');
            return new RedisStore({
                host: parsed_url.hostname,
                port: parsed_url.port,
                pass: parsed_auth[1]
            });
        }())
    }));
    app.use(express['static'](__dirname + '/../public'));
    app.use(function (req, res, next) {
        if (req.session && req.session.user && ! req.session.user.name) {
            db.collection('user', function (err, collection) {
                if (err) { throw err; }
                collection.findOne({
                    _id: String(req.session.user.user_id)
                }, function (err, data) {
                    if (err) { throw err; }
                    if (data) {
                        var user = req.session.user;
                        user.image = data.profile_image_url;
                        user.name  = data.name;
                        req.session.user = user;
                    }
                    next();
                });
            });
        }
        else {
            next();
        }
    });
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

app.get('/', function (req, res) {
    res.render('index');
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
    var twitter = new oauth.OAuth(
        'https://api.twitter.com/oauth/request_token',
        'https://api.twitter.com/oauth/access_token',
        process.env.npm_package_config__twitter_consumer_key,
        process.env.npm_package_config__twitter_consumer_secret,
        '1.0', null, 'HMAC-SHA1'
    );
    if (req.query.oauth_token && req.query.oauth_verifier) {
        twitter.getOAuthAccessToken(
            req.query.oauth_token,
            req.query.oauth_verifier,
            function (err, token, token_secret, results) {
                if (err) {
                    res.send(err.data, err.statusCode);
                    return;
                }
                req.session.user = results;
                res.redirect('/');
                // user info
                twitter.get(
                    'http://api.twitter.com/1/users/show.json?id=' + results.user_id,
                    token, token_secret, function (err, data) {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        // save to db
                        var obj = JSON.parse(data);
                        var user_data = {};
                        ['id', 'name', 'screen_name', 'description', 'profile_image_url', 'location', 'url', 'lang', 'protected']
                            .forEach(function(e) {
                                user_data[e] = obj[e];
                            });
                        user_data._id = String(user_data.id);
                        db.collection('user', function (err, collection) {
                            if (err) {
                                console.error(err);
                                return;
                            }
                            collection.update({
                                _id: user_data._id
                            }, user_data, {
                                upsert: true
                            }, function (err) {
                                if (err) { console.error(err); }
                            });
                        });
                    }
                );
            }
        );
    }
    else {
        twitter.getOAuthRequestToken(function (err, token, token_secret, results) {
            if (err) {
                res.send(err.data, err.statusCode);
                return;
            }
            res.redirect(twitter.signUrl(
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
        if (err) { throw err; }
        res.end(JSON.stringify(data));
    });
});

app.on('listening', function () {
    var mongo_config = (function () {
        var parsed_url  = url.parse(process.env.npm_package_config__mongo_url || 'mongodb://127.0.0.1:27017/momocloop');
        var parsed_auth = parsed_url.auth ? parsed_url.auth.split(':') : null;
        var config = {
            host: parsed_url.hostname,
            port: parsed_url.port,
            dbname: parsed_url.pathname.substr(1)
        };
        if (parsed_auth) {
            config.username = parsed_auth[0];
            config.password = parsed_auth[1];
        }
        return config;
    }());
    db = new model.Db(mongo_config);
    db.open(function (err) {
        if (err) { throw err; }
        console.log('db for app is ready');
    });
});
app.on('close', function () {
    db.close(function (err) {
        if (err) { throw err; }
    });
});
