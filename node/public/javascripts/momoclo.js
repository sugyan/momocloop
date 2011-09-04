var onFinishAddCallback = function () {
    var player = document.getElementById('player');
    // FIXME
    $.ajax({
        url: '/api/program',
        dataType: 'json',
        success: function (data) {
            player.sync(data);
        }
    });
};

$(function () {
    swfobject.embedSWF(
        '/swf/player.swf',
        'player','800', '600', "10.0.0", null, {}, {}, {}
    );
});
