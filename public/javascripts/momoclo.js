var started;
var onFinishAddCallback, onFinishStream, onInfo;
var loadStream = function () {
    var player = document.getElementById('player');
    $.ajax({
        url: '/api/program',
        dataType: 'json',
        success: function (data) {
            var seek = (new Date() - data.start) / data.length;
            player.sync({ vid: data.vid, seek: seek });

            $('#info').text(data.title);
            started = new Date(data.start).getTime();
        }
    });
};
var onInfo = function (data) {
    var lag = (new Date().getTime() - started - data.time * 1000);
    if (Math.abs(lag) > 500) {
        loadStream();
    }
};
onFinishAddCallback = onFinishStream = loadStream;

$(function () {
    var socket = io.connect();
    // swf
    swfobject.embedSWF(
        '/swf/player.swf',
        'player','480', '360', "10.0.0", null, {}, {}, {}
    );
    // comment
    var prependMessage = function (data) {
        var date = new Date(data.date);
        var dateStr = [
            date.getHours()   < 10 ? '0' + date.getHours()   : String(date.getHours()),
            date.getMinutes() < 10 ? '0' + date.getMinutes() : String(date.getMinutes()),
            date.getSeconds() < 10 ? '0' + date.getSeconds() : String(date.getSeconds())
        ].join(':');
        $('#messages').prepend(
            $('<div>').addClass('message')
                .append($('<span>').addClass('date').text(dateStr))
                .append($('<span>').addClass('name').text(data.name))
                .append($('<span>').addClass('text').text(data.text))
        );
        while ($('.message').length > 100) {
            $('.message').last().remove();
        }
    };
    // socket.io
    socket.on('comment', prependMessage);
    socket.on('connection', function (data) {
        $('#connection').text(data + '人');
    });
    $('#comments').submit(function (e) {
        e.preventDefault();
        var input = $('#message');
        var text = input.val();
        if (text.length > 0) {
            if (text.length < 50) {
                socket.emit('comment', input.val());
                prependMessage({
                    date: new Date().getTime(),
                    name: 'you',
                    text: text
                });
            }
            input.val('');
        }
    });
    $('#message').focus();
});
