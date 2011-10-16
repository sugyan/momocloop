var child_process = require('child_process');
var http = require('http');
var testTCP = require('test-tcp');
var testCase = require('nodeunit').testCase;
var Program = require('../lib/program');

var dummyData = {
    results: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (e) {
        return {
            id: e,
            lengthInSecond: e * 100,
            imageUrl: {
                small: 'dummyImage' + e + '1',
                medium: 'dummyImage' + e + '2'
            }
        };
    })
};

module.exports = testCase({
    setUp: function (callback) {
        var self = this;
        testTCP.empty_ports(2, function (err, ports) {
            if (err) {
                throw err;
            }
            self.ports = ports;

            var redis = self.redis = child_process.spawn(
                'redis-server', ['-']
            );
            redis.stdout.on('data', function (chunk) {
                if (/now ready to accept connections/.test(chunk)) {
                    var api = self.api = http.createServer(function (req, res) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(dummyData));
                    });
                    api.listen(ports[1], function () {
                        callback();
                    });
                }
            });
            redis.stdin.write('port ' + self.ports[0]);
            redis.stdin.end();
        });
    },
    tearDown: function (callback) {
        var self = this;
        self.api.on('close', function () {
            self.redis.on('exit', function () {
                callback();
            });
            self.redis.kill();
        });
        self.api.close();
    },
    generateProgram: function (test) {
        var self = this;
        var program = new Program({
            redis: 'redis://127.0.0.1:' + self.ports[0]
        });
        test.ok(program, 'program instance');

        program._generateProgram('talk', dummyData, function (err, data) {
            var obj = {};
            test.ifError(err);
            test.equal(data.length, 5, '5 data exist');
            data.forEach(function (e) {
                obj[JSON.parse(e).id] = true;
            });
            test.equal(Object.keys(obj).length, 5, '5 unique results');
            test.done();
        });
        // simultaneously generate
        program._generateProgram('talk', dummyData, function () {});
        program._generateProgram('talk', dummyData, function () {});

        process.on('uncaughtException', function (err) {
            console.error('%s: %s', err.type, err.message);
            test.fail('uncaughtException');
            test.done();
        });
    },
    getPrograms: function (test) {
        var self = this;
        var program = new Program({
            redis: 'redis://127.0.0.1:' + self.ports[0],
            api: {
                host: '127.0.0.1',
                port: self.ports[1],
                path: '/',
                key: ''
            }
        });
        test.ok(program, 'program instance');

        // get from api, and return programs
        program.getPrograms('talk', function (err, data1) {
            test.ifError(err);
            test.equal(data1.length, 5, 'got 5 data');
            test.ok(data1[0].started, 'first data has "started"');
            program.getPrograms('talk', function (err, data2) {
                test.deepEqual(data1, data2, 'same data');
                test.done();
            });
        });

        process.on('uncaughtException', function (err) {
            console.error('%s: %s', err.type, err.message);
            test.fail('uncaughtException');
            test.done();
        });
    }
});
