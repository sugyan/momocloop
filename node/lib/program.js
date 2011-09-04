var qs = require('qs');
var http = require('http');

function Program (config, callback) {
    this.config = config;
    this.programs = [];
    this.decideProgram(callback);
}

Program.prototype.decideProgram = function (callback) {
    var self = this;
    this.getRecords(function (err, data) {
        if (err) { throw err; }
        var picked;
        var results = data.results;
        if (self.programs.length === 0) {
            picked = results[Math.floor(Math.random() * results.length)];
            self.programs.push({
                vid: picked.id,
                title: picked.title,
                length: picked.lengthInSecond * 1000,
                image: picked.imageUrl,
                start: new Date()
            });
        }
        if (callback) { callback(null); }
    });
};

Program.prototype.getRecords = function (callback) {
    var query = qs.stringify({
        key: this.config.key || '',
        limit: '50'
    });
    // TODO: error handling
    http.get({
        host: 'api.ustream.tv',
        path: '/json/user/momoiroclover/listAllVideos?' + query
    }, function (res) {
        var buffer = '';
        res.on('data', function (chunk) {
            buffer += chunk;
        });
        res.on('end', function () {
            callback(null, JSON.parse(buffer));
        });
    });
};

Program.prototype.getCurrent = function (callback) {
    if (this.programs.length > 0) {
        callback(null, this.programs[0]);
    }
    else {
        var self = this;
        this.decideProgram(function (err) {
            if (err) { throw err; }
            callback(null, self.programs[0]);
        });
    }
};

module.exports = Program;
