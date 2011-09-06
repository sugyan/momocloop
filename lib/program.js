var qs = require('qs');
var http = require('http');

function Program (config) {
    this.config = config;
    this.programs = [];
}

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
    var self = this;
    var data = this.programs[0];
    if (data) {
        if (new Date() - data.start < data.length) {
            callback(null, data);
            return;
        }
        else {
            this.programs.shift();
        }
    }
    this.getRecords(function (err, data) {
        if (err) { throw err; }
        if (self.programs.length === 0) {
            var picked = data.results[Math.floor(Math.random() * data.results.length)];
            self.programs.push({
                vid: picked.id,
                title: picked.title,
                length: picked.lengthInSecond * 1000,
                image: picked.imageUrl,
                start: new Date()
            });
        }
        callback(null, self.programs[0]);
    });
};

module.exports = Program;