var $ = window.jQuery;
var io = window.io;
var twttr = window.twttr;
var Momoclo = window.Momoclo = {};

Momoclo.loadProgram = function (callback) {
    $.ajax({
        url: '/api/program',
        dataType: 'json',
        success: callback
    });
};

Momoclo.connection = io.connect('/connection');
Momoclo.connection.on('connect', function () {
    Momoclo.connection.emit('join', location.pathname);
});
Momoclo.connection.on('connection', function (data) {
    if (window.webkitNotifications && window.webkitNotifications.checkPermission() === 0) {
        var notification = window.webkitNotifications.createNotification('', 'momocloop', JSON.stringify(data));
        notification.show();
        window.setTimeout(function () {
            notification.cancel();
        }, 3000);
    }
});

if (window.location.pathname === '/') {
    $(function () {
        var started, duration;
        var toMmSsString = function (seconds) {
            var m = Math.floor(seconds / 60);
            var s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' + s : s);
        };
        var setProgramInfo = function (result) {
            var current = result[0];
            var div = $('.room');
            started  = current.started;
            duration = current.lengthInSecond * 1000;
            div.find('.image').empty().append(
                $('<a>').attr({ href: '/live' })
                    .append($('<img>').attr({ src: current.image2 }))
            );
            div.find('.title').empty().append(
                $('<a>').attr({ href: '/live' }).text(current.title)
            );
            div.find('.description').text(current.description);
            div.find('.created').text(current.createdAt);
            div.find('.duration').text(toMmSsString(current.lengthInSecond));
        };
        Momoclo.loadProgram(setProgramInfo);
        window.setInterval(function () {
            var now = new Date().getTime();
            if (started) {
                $('.room .nowplaying').text(toMmSsString((now - started) / 1000));
                if (now - (started + duration) > 0) {
                    Momoclo.loadProgram(setProgramInfo);
                }
            }
        }, 200);
        // connections
        Momoclo.connection.on('connection', function (data) {
            $('.room .connections').text(data + '人');
        });
    });
} else {
    $(function () {
        var started, duration;
        var myname = 'you';
        var displayCall = function (data, myself) {
            var message = {
                a: ['あーりん！',   '#FF00FF'],
                m: ['ももか！',     '#00FF00'],
                k: ['かなこぉ↑',   '#FF0000'],
                s: ['しおりん！',   '#FFFF00'],
                r: ['れにちゃん！', '#800080'],
                h: ['あかりん！',   '#0000FF'],
                u: ['うりゃ！',     '#808080'],
                o: ['おい！',       '#808080'],
                z: ['ゼーット！',   '#FFFFFF']
            }[data];
            var div = $('<div>').addClass('call').css({
                top: Math.random() * (100 - 10),
                left: Math.random() * 480 - 30,
                color: message[1],
                'font-size': myself ? 'large' : 'normal'
            }).text('＼' + message[0] + '／');
            $('#display').append(div);
            window.setTimeout(function () {
                div.fadeOut('fast', function () { div.remove(); });
            }, 1000);
        };
        var prependMessage = function (data) {
            var date = new Date(data.date);
            var dateStr = [
                date.getHours()   < 10 ? '0' + date.getHours()   : String(date.getHours()),
                date.getMinutes() < 10 ? '0' + date.getMinutes() : String(date.getMinutes()),
                date.getSeconds() < 10 ? '0' + date.getSeconds() : String(date.getSeconds())
            ].join(':');
            $('#messages')
                .prepend(
                    $('<dd>').addClass('message text')
                        .append($('<span>').addClass('text').text(data.text))
                )
                .prepend(
                    $('<dt>').addClass('message info')
                        .append($('<span>').addClass('date').text(dateStr))
                        .append($('<span>').addClass('name').text(data.name))
                );
            while ($('.message').length > 100) {
                $('.message').last().remove();
            }
            // anywhere
            twttr.anywhere(function (t) {
                t('#messages').linkifyUsers({ className: 'blank' });
                $('#messages a.blank').attr({ target: '_blank' });
            });
        };
        var keyboardCommand = function (e) {
            if ($.inArray(e.keyCode, [65, 72, 75, 77, 79, 82, 83, 85, 90]) !== -1) {
                var id = String.fromCharCode(e.keyCode).toLowerCase();
                $('#' + id).click();
            }
        };
        var setProgramInfo = function (result) {
            var current = result[0];
            var created = new Date(current.createdAt);
            started = current.started;
            duration = current.lengthInSecond * 1000;
            $('#title').html($('<a>').attr({ href: current.url, target: '_blank' }).text(current.title));
            $('#description').text(current.description);
            $('#created').text(created.toLocaleString());
            // after 2011-04-10 ?
            if (created >= new Date(1302447600000)) {
                $.each(['a', 'm', 'k', 's', 'r'], function (i, e) {
                    $('#' + e).addClass('z');
                });
                $('#h').hide();
                $('#z').data('z', true);
            } else {
                $.each(['a', 'm', 'k', 's', 'r'], function (i, e) {
                    $('#' + e).removeClass('z');
                });
                $('#h').show();
                $('#z').data('z', false);
            }
        };

        // program info
        Momoclo.loadProgram(setProgramInfo);
        window.setInterval(function () {
            var now = new Date().getTime();
            if (started > 0) {
                if (now - (started + duration) > 0) {
                    Momoclo.loadProgram(setProgramInfo);
                }
            }
        }, 200);

        // socket.io
        var socket = io.connect('/player');
        socket.on('connect', function () {
            socket.emit('join', window.location.pathname);
        });
        socket.on('name', function (name) {
            myname = name;
        });
        socket.on('comment', prependMessage);
        socket.on('call', displayCall);

        // connections
        Momoclo.connection.on('connection', function (data) {
            $('#connection').text(data + '人');
        });

        // buttons
        $('#buttons button').click(function () {
            var id = $(this).attr('id');
            var button = $('#' + id);
            if (button.css('display') !== 'none' || button.data('z')) {
                socket.emit('call', id);
                displayCall(id, true);
            }
        });
        // form
        $('#comments').submit(function (e) {
            e.preventDefault();
            var input = $('#message');
            var text = input.val();
            if (text.length > 0) {
                if (text.length < 50) {
                    socket.emit('comment', {
                        text: input.val()
                    });
                    prependMessage({
                        date: new Date().getTime(),
                        name: myname,
                        text: text
                    });
                }
                input.val('');
            }
        });
        $('#message')
            .focus(function () {
                $(document).unbind('keyup', keyboardCommand);
            })
            .focusout(function () {
                $(document).bind('keyup', keyboardCommand);
            });
        $(document).bind('keyup', keyboardCommand);

        // swf
        swfobject.embedSWF('/swf/player.swf', 'player','620', '460', '11.0.0', '/swf/expressInstall.swf', {}, {}, {});
    });
}
