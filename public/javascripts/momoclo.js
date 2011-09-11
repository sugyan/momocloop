var momoclo = {};

momoclo.loadStream = function () {
    var player = document.getElementById('player');
    $.ajax({
        url: '/api/program',
        dataType: 'json',
        data: {
            type: window.location.pathname === '/live' ? 'live' : 'talk'
        },
        success: function (data) {
            $('#duration').text(data.lengthInSecond);
            player.sync({ vid: data.id, start: data.started });

            $('#title').html($('<a>').attr({ href: data.url, target: '_blank' }).text(data.title));
            $('#description').text(data.description);
            $('#created').text(data.createdAt);
            momoclo.started = new Date(data.started).getTime();
        }
    });
};
momoclo.onFinishAddCallback = momoclo.onFinishStream = momoclo.loadStream;
momoclo.progress = function (time) {
    var i, str = String(time).replace(/(\d+)\.(\d)(.*)/, '$1.$2');
    $('#time').text(str);
};

var socket = io.connect();
socket.on('connect', function () {
    socket.emit('join', window.location.pathname);
});

if (window.location.pathname === '/') {
    $(function () {
        var started  = {};
        var duration = {};
        var toMmSsString = function (seconds) {
            var m = Math.floor(seconds / 60);
            var s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' + s : s);
        };
        var loadProgram = function () {
            $.each(['live', 'talk'], function (i, e) {
                $.ajax({
                    url: '/api/program',
                    dataType: 'json',
                    data: { type: e },
                    success: function (data) {
                        var div = $('#' + e);
                        started[e]  = data.started;
                        duration[e] = data.lengthInSecond * 1000;
                        div.find('.image').empty().append(
                            $('<a>').attr({ href: '/' + e })
                                .append($('<img>').attr({ src: data.image2 }))
                        );
                        div.find('.title').empty().append(
                            $('<a>').attr({ href: '/' + e }).text(data.title)
                        );
                        div.find('.description').text(data.description);
                        div.find('.created').text(data.createdAt);
                        div.find('.duration').text(toMmSsString(data.lengthInSecond));
                    }
                });
            });
        };
        loadProgram();
        setInterval(function () {
            var now = new Date().getTime();
            $.each(['live', 'talk'], function (i, e) {
                if (started[e]) {
                    $('#' + e + ' .nowplaying').text(toMmSsString((now - started[e]) / 1000));
                    if (now - (started[e] + duration[e]) > 0) {
                        loadProgram();
                    }
                }
            });
        }, 200);
        // connections
        socket.on('connection', function (data) {
            $.each(['live', 'talk'], function (i, e) {
                var val = data['/' + e] ? data['/' + e].length : 0;
                $('#' + e + ' .connections').text(val + '人');
            });
        });
    });
}
else {
    $(function () {
        var myname = 'you';
        // comment
        var prependMessage = function (data) {
            var date = new Date(data.date);
            var dateStr = [
                date.getHours()   < 10 ? '0' + date.getHours()   : String(date.getHours()),
                date.getMinutes() < 10 ? '0' + date.getMinutes() : String(date.getMinutes()),
                date.getSeconds() < 10 ? '0' + date.getSeconds() : String(date.getSeconds())
            ].join(':');
            var div = $('<div>').addClass('message')
                .append($('<span>').addClass('date').text(dateStr))
                .append($('<span>').addClass('name').text(data.name))
                .append($('<span>').addClass('text').text(data.text));
            $('#messages').prepend(div.hide());
            div.slideDown();
            while ($('.message').length > 100) {
                $('.message').last().remove();
            }
            // anywhere
            twttr.anywhere(function (T) {
                T('#messages').linkifyUsers({ className: 'blank' });
                $('#messages a.blank').attr({ target: '_blank' });
            });
        };
        // swf
        swfobject.embedSWF('/swf/player.swf', 'player','480', '360', "10.0.0", null, {}, {}, {});
        // socket.io
        socket.on('name', function (name) {
            myname = name;
        });
        socket.on('comment', prependMessage);
        socket.on('connection', function (data) {
            $('#connection').text(data[window.location.pathname].length + '人');
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
                        name: myname,
                        text: text
                    });
                }
                input.val('');
            }
        });
        $('#message').focus();
    });
}
