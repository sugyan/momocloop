var test = require('tap').test;
var async = require('async');
var TestTCP = require('test-tcp');

var port1, port2;

function main (done) {
    var program = new (require('../lib/program'))({
        mongo: {
            host: '127.0.0.1',
            port: port1,
            dbname: 'test'
        },
        api: {
            endpoint: {
                host: '127.0.0.1',
                port: port2,
                path: '/'
            },
            key: ''
        }
    });
    var dummyData = {
        results: [ {
            id: 1,
            lengthInSecond: 100,
            imageUrl: {
                small: 'dummyImage11',
                medium: 'dummyImage12'
            }
        }, {
            id: 2,
            lengthInSecond: 200,
            imageUrl: {
                small: 'dummyImage21',
                medium: 'dummyImage22'
            }
        }, {
            id: 3,
            lengthInSecond: 300,
            imageUrl: {
                small: 'dummyImage31',
                medium: 'dummyImage32'
            }
        } ]
    };

    test('program', function (t) {
        var mongod, api;
        t.on('end', function () {
            if (mongod)        { mongod.kill(); }
            if (api && api.fd) { api.close();   }
            done();
        });
        async.series([
            function (callback) {
                mongod = require('child_process').spawn('mongod', [
                    '--dbpath', 't/db',
                    '--port', port1
                ]);
                mongod.stdout.on('data', function (data) {
                    var stdout = data.toString();
                    if (RegExp('exception').test(stdout)) {
                        callback('mongod error');
                    }
                    else if (RegExp('waiting for connections on port ' + port1).test(stdout)) {
                        callback();
                    }
                });
            },
            function (callback) {
                program.open(callback);
            },
            // all remove
            function (callback) {
                program.collection.remove({}, callback);
            },
            // getRecords (error!)
            function (callback) {
                program.getRecords(function (err, data) {
                    t.equal(err.code, 'ECONNREFUSED', 'error code');
                    t.notOk(data, 'no data');
                    callback();
                });
            },
            function (callback) {
                api = require('http').createServer(function (req, res) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(dummyData));
                });
                api.on('listening', callback);
                api.listen(port2);
            },
            // getRecords
            function (callback) {
                program.getRecords(function (err, data) {
                    t.notOk(err, 'success');
                    t.deepEqual(data, dummyData, 'data');
                    callback();
                });
            },
            // setPrograms
            function (callback) {
                program.setPrograms('talk', function (err) {
                    t.notOk(err, 'success');
                    callback();
                });
            },
            // getCurrent
            function (callback) {
                program.getCurrent('talk', function (err, data) {
                    t.notOk(err, 'success');
                    t.ok(data, 'current data');
                    var current = data;
                    program.getCurrent('talk', function (err, data) {
                        t.equivalent(data, current, 'current not changed');
                        callback();
                    });
                });
            },
            function (callback) {
                program.close(callback);
            }
        ], function (err, results) {
            if (err) { console.error(err); }
            t.equal(err, undefined, 'no errors');
            t.end();
        });

        process.on('uncaughtException', function (err) {
            console.error(err);
            t.fail('no uncaughtExceptions');
            t.end();
        });
    });
}

async.series([
    function (callback) {
        TestTCP.empty_port(function (err, port) {
            if (err) { callback(err); }
            port1 = port;
            callback();
        });
    },
    function (callback) {
        TestTCP.empty_port(function (err, port) {
            if (err) { callback(err); }
            port2 = port;
            callback();
        });
    },
    function (callback) {
        main(callback);
    }
], function (err) {
    if (err) { throw err; }
});
