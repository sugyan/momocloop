var assert        = require('assert');
var child_process = require('child_process');
var http          = require('http');
var TestTCP       = require('test-tcp');
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

suite('program', function (args) {
    setup(function (done) {
        var self = this;
        TestTCP.empty_ports(2, function (err, ports) {
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
                        done();
                    });
                }
            });
            redis.stdin.write('port ' + self.ports[0]);
            redis.stdin.end();
        });
    });
    teardown(function (done) {
        var self = this;
        self.api.on('close', function () {
            self.redis.on('exit', function () {
                done();
            });
            self.redis.kill();
        });
        self.api.close();
    });
    test('generateProgram', function (done) {
        var self = this;
        var program = new Program({
            redis: 'redis://127.0.0.1:' + self.ports[0],
            lives: {
                '2': true, '4': true, '6': true, '8': true
            }
        });
        assert.ok(program, 'program instance');

        program._generateProgram(dummyData, function (err, data) {
            var obj = {};
            assert.ifError(err);
            assert.equal(data.length, program.num, program.num + ' data exist');
            data.forEach(function (e) {
                obj[JSON.parse(e).id] = true;
            });
            assert.equal(Object.keys(obj).length, program.num, 'unique results');
            done();
        });
        // simultaneously generate
        program._generateProgram(dummyData, function () {});
        program._generateProgram(dummyData, function () {});

        process.on('uncaughtException', function (err) {
            console.error('%s: %s', err.type, err.message);
            assert.fail('uncaughtException');
            done();
        });
    });
    test('getPrograms', function (done) {
        var self = this;
        var program = new Program({
            redis: 'redis://127.0.0.1:' + self.ports[0],
            api: {
                host: '127.0.0.1',
                port: self.ports[1],
                path: '/',
                key: ''
            },
            lives: {
                '2': true, '4': true, '6': true, '8': true
            }
        });
        assert.ok(program, 'program instance');

        // get from api, and return programs
        program.getPrograms(function (err, data1) {
            assert.ifError(err);
            assert.equal(data1.length, program.num, 'got ' + program.num + ' data');
            assert.ok(data1[0].started, 'first data has "started"');
            program.getPrograms(function (err, data2) {
                assert.deepEqual(data1, data2, 'same data');
                done();
            });
        });
        // simultaneously generate
        program.getPrograms(function () {});
        program.getPrograms(function () {});

        process.on('uncaughtException', function (err) {
            console.error('%s: %s', err.type, err.message);
            assert.fail('uncaughtException');
            done();
        });
    });
    test('getPrograms on Error', function (done) {
        var self = this;
        TestTCP.empty_port(function (err, port) {
            var program = new Program({
                redis: 'redis://127.0.0.1:' + self.ports[0],
                api: {
                    host: '127.0.0.1',
                    port: port,
                    path: '/',
                    key: ''
                }
            });
            var api = http.createServer(function (req, res) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('dummy error!');
            });
            api.listen(port, function () {
                api.on('close', function () {
                    done();
                });
                program.getPrograms(function (err, data) {
                    assert.ok(err);
                    assert.equal(err.message, 'dummy error!', 'error message');
                    api.close();
                });
            });
        });
    });
});
