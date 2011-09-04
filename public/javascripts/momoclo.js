var onFinishAddCallback = function () {
    var player = document.getElementById('player');
    $.ajax({
        url: '/api/program',
        dataType: 'json',
        success: function (data) {
            $('#info').text(data.title);
            player.sync(data);
        }
    });
};

$(function () {
    swfobject.embedSWF(
        '/swf/player.swf',
        'player','480', '360', "10.0.0", null, {}, {}, {}
    );

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

    var socket = io.connect();
    socket.on('comment', prependMessage);

    var input = $('#message');
    $('#comments').submit(function (e) {
        e.preventDefault();
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
    input.focus();
});
