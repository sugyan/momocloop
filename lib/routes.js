/**
 * Module dependencies.
 */

var oauth = require('oauth');
var Program = require('./program');

var util = require('./util');

// Common instance

var twitter = new oauth.OAuth(
    'https://api.twitter.com/oauth/request_token',
    'https://api.twitter.com/oauth/access_token',
    process.env.npm_package_config__twitter_consumer_key,
    process.env.npm_package_config__twitter_consumer_secret,
    '1.0', null, 'HMAC-SHA1'
);

// Middleware

exports.middleware = {
    twitter: function (req, res, next) {
        if (req.session && req.session.user && ! req.session.user.name) {
            // user info
            twitter.get(
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
    }
};

// Routes

exports.index = function (req, res) {
    res.render('index', { isTop: true });
};

exports.live = function (req, res) {
    res.render('play', {
        title: 'Live! - '
    });
};

exports.talk = function (req, res) {
    res.render('play', {
        title: 'Talk! - '
    });
};

exports.signin = function (req, res) {
    if (req.query.oauth_token && req.query.oauth_verifier) {
        twitter.getOAuthAccessToken(
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
    } else {
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
};

exports.signout = function (req, res) {
    req.session.destroy();
    res.redirect('/');
};

exports.settings = function (req, res) {
    res.render('settings');
};

exports.api = {
    program: function (req, res) {
        var program = new Program({
            redis: process.env.npm_package_config__redis_url || 'redis://127.0.0.1:6379'
        });
        program.getPrograms(function (err, data) {
            if (err) {
                res.send(err.message, 500);
            } else {
                res.json(data);
            }
        });
    }
};
