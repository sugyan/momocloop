var url = require('url');
var redis = require('redis');
var express = require('express');
var connect_redis = require('connect-redis');

exports.getRedisClient = function (redis_url) {
    var parsed_url  = url.parse(redis_url);
    var parsed_auth = (parsed_url.auth || '').split(':');
    var client = redis.createClient(parsed_url.port, parsed_url.hostname);
    if (parsed_auth.length > 1) {
        client.auth(parsed_auth[1], function (err) {
            if (err) {
                throw err;
            }
        });
    }
    return client;
};

exports.getRedisStore = function (redis_url) {
    var RedisStore  = connect_redis(express);
    var parsed_url  = url.parse(redis_url);
    var parsed_auth = (parsed_url.auth || '').split(':');
    return new RedisStore({
        host: parsed_url.hostname,
        port: parsed_url.port,
        pass: parsed_auth[1]
    });
};
