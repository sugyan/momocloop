/**
 * Module dependencies.
 */

var Program = require('./program');
var _ = require('underscore');
var oauth = require('oauth');
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

var program = new Program();

// Routes

app.get('/', function (req, res) {
    res.render('index');
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

app.get('/api/program', function (req, res) {
    program.getCurrent(function (err, data) {
        if (err) { throw err; }
        res.end(JSON.stringify(data));
    });
});
