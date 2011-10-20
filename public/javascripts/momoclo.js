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
            var current = data[0];
            $('#duration').text(current.lengthInSecond);
            player.sync({ vid: current.id, start: current.started });

            var created = new Date(current.createdAt);
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
            momoclo.vid = current.id;
            momoclo.started = new Date(current.started).getTime();
        }
    });
};
momoclo.onFinishAddCallback = momoclo.loadStream;
momoclo.onFinishStream = function () {
    setTimeout(momoclo.loadStream, 1000);
};
momoclo.progress = function (time) {
    var t = Math.floor(time * 10);
    $('#time').text((t - (t % 10)) / 10 + '.' + t % 10);
};

var connection = io.connect('/connection');
connection.on('connect', function () {
    connection.emit('join', location.pathname);
});
connection.on('connection', function (data) {
    if (window.webkitNotifications && window.webkitNotifications.checkPermission() === 0) {
        var notification = window.webkitNotifications.createNotification('', 'momocloop', JSON.stringify(data));
        notification.show();
        setTimeout(function () {
            notification.cancel();
        }, 3000);
    }
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
                        var current = data[0];
                        var div = $('#' + e);
                        started[e]  = current.started;
                        duration[e] = current.lengthInSecond * 1000;
                        div.find('.image').empty().append(
                            $('<a>').attr({ href: '/' + e })
                                .append($('<img>').attr({ src: current.image2 }))
                        );
                        div.find('.title').empty().append(
                            $('<a>').attr({ href: '/' + e }).text(current.title)
                        );
                        div.find('.description').text(current.description);
                        div.find('.created').text(current.createdAt);
                        div.find('.duration').text(toMmSsString(current.lengthInSecond));
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
        connection.on('connection', function (data) {
            $.each(['live', 'talk'], function (i, e) {
                $('#' + e + ' .connections').text(data[e] + '人');
            });
        });
    });
}
else {
    $(function () {
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
            setTimeout(function () {
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
        connection.on('connection', function (data) {
            $('#connection').text(data[location.pathname.replace(/^\//, '')] + '人');
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
                        vid: momoclo.vid,
                        time: $('#time').text(),
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
        swfobject.embedSWF('/swf/player.swf', 'player','480', '360', "11.0.0", null, {
            type: window.location.pathname === '/live' ? 'live' : 'talk'
        }, {}, {});
    });
}
