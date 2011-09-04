var onFinishAddCallback = function () {
    var player = document.getElementById('player');

    // FIXME
    (function () {
        var length = 2 * 3600 + 36 * 60 + 35;
        var now = new Date();
        var start = new Date(2011, 8, 4, 15, 30);
        player.sync({
            vid: '15776910',
            seek: (now - start) / 1000 / length
        });
    }());
};

$(function () {
    swfobject.embedSWF(
        '/swf/player.swf',
        'player','800', '600', "10.0.0", null, {}, {}, {}
    );
});
