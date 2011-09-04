var onFinishAddCallback = function () {
    var player = document.getElementById('player');
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
        'player','480', '360', "10.0.0", null, {}, {}, {}
    );
});
