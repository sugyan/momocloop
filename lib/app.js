/**
 * Module dependencies.
 */

var model = require('./model');
var _ = require('underscore');
var oauth = require('oauth');
var express = require('express');
var app = module.exports = express.createServer();
var db, program, config = {};

// Configuration

app.configure(function () {
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
        secret: process.env.npm_package_config__http_session_secret || 'dummy',
        store: model.sessionStore
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
    _.extend(config, require('./../config/development'));
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
    if (req.session.oauth && (req.query.oauth_token && req.query.oauth_verifier)) {
        delete req.session.oauth;
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
            req.session.oauth = {
                twitter: {
                    token: token,
                    token_secret: token_secret,
                    results: results
                }
            };
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

app.get('/api/program', function (req, res) {
    var type = req.param('type') === 'live' ? 'live' : 'talk';
    program.getCurrent(type, function (err, data) {
        if (err) { throw err; }
        res.end(JSON.stringify(data));
    });
});

app.on('listening', function () {
    var mongoConfig = config.mongo || {
        host: process.env.npm_package_config__mongodb_host,
        port: process.env.npm_package_config__mongodb_port,
        dbname: process.env.npm_package_config__mongodb_dbname,
        username: process.env.npm_package_config__mongodb_username,
        password: process.env.npm_package_config__mongodb_password
    };
    db = new model.Db(mongoConfig);
    program = new (require('./program'))({
        mongo: mongoConfig,
        api: {
            key: process.env.npm_package_config__ustream_key
        }
    });

    db.open(function (err) {
        if (err) { throw err; }
    });
    program.open(function (err) {
        if (err) { throw err; }
    });
});
app.on('close', function () {
    program.close(function (err) {
        if (err) { throw err; }
    });
    db.close(function (err) {
        if (err) { throw err; }
    });
});
