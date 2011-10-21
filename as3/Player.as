package {
    import flash.display.Loader;
    import flash.display.Sprite;
    import flash.events.Event;
    import flash.events.TimerEvent;
    import flash.external.ExternalInterface;
    import flash.net.URLLoader;
    import flash.net.URLRequest;
    import flash.system.ApplicationDomain;
    import flash.system.LoaderContext;
    import flash.system.Security;
    import flash.text.TextField;
    import flash.text.TextFormat;
    import flash.text.TextFormatAlign;
    import flash.utils.Timer;

    import tv.ustream.viewer.logic.Logic;

    [SWF(backgroundColor="0x000000")]
    public class Player extends Sprite {
        private var viewerLoader:Loader;
        private var recorded:Object;
        private var viewer:Object;
        private var started:Number;
        private var duration:String;

        public function Player() {
            Security.allowDomain("*");
            viewerLoader = new Loader();
            viewerLoader.contentLoaderInfo.addEventListener(Event.COMPLETE, onRslLoad);

            var applicationDomain:ApplicationDomain = ApplicationDomain.currentDomain;
            var loaderContext:LoaderContext = new LoaderContext();
            var request:URLRequest = new URLRequest("http://www.ustream.tv/flash/viewer.rsl.swf");

            loaderContext.applicationDomain = applicationDomain;
            viewerLoader.load(request, loaderContext);

            var time:TextField = new TextField();
            var timeFormat:TextFormat = new TextFormat();
            timeFormat.align = TextFormatAlign.RIGHT;
            timeFormat.color = 0xFFFFFF;
            time.defaultTextFormat = timeFormat;
            time.text = " ";
            time.width = stage.stageWidth;
            time.y = stage.stageHeight - time.textHeight;
            this.addChild(time);

            var progressTimer:Timer = new Timer(200);
            progressTimer.addEventListener(TimerEvent.TIMER, function (e:TimerEvent):void {
                if (recorded && recorded.duration) {
                    time.text = getMMSS(recorded.time) + " / " + duration;
                }
            });
            progressTimer.start();

            var syncTimer:Timer = new Timer(2000);
            syncTimer.addEventListener(TimerEvent.TIMER, sync);
            syncTimer.start();
        }

        private function sync(e:Event):void {
            if (recorded) {
                recorded.play();
                var now:Number = new Date().getTime();
                var lag:Number = recorded.time * 1000 - (now - started);
                if (lag < -400) {
                    recorded.seek((now - started + 200) / recorded.duration / 1000);
                }
                if (lag > 100) {
                    var timer:Timer = new Timer(lag - 50, 1);
                    timer.addEventListener(TimerEvent.TIMER, function (e:TimerEvent):void {
                        recorded.play();
                    });
                    recorded.pause();
                    timer.start();
                }
            }
        }

        private function onRslLoad(e:Event):void {
            var logicClass:Class = viewerLoader.contentLoaderInfo.applicationDomain.getDefinition("tv.ustream.viewer.logic.Logic") as Class;
            viewer = new logicClass();
            viewer.display.width = this.stage.stageWidth;
            viewer.display.height = this.stage.stageHeight;
            viewer.playing = true;

            this.addChildAt(viewer.display, 0);
            getProgram();
        }

        private function getProgram():void {
            var apiLoader:URLLoader = new URLLoader();
            var request:URLRequest = new URLRequest("http://momoclo.no.de/api/program?type=" + PROGRAM::type);
            apiLoader.addEventListener(Event.COMPLETE, function (e:Event):void {
                var data:Object = JSON.parse(apiLoader.data)[0];
                if (! (recorded && recorded.mediaId === data.id)) {
                    recorded = viewer.createRecorded(data.id);
                    recorded.addEventListener("createStream", function ():void {
                        duration = getMMSS(recorded.duration);
                    });
                    recorded.addEventListener("finish", function ():void {
                        getProgram();
                    });
                    started = data.started;
                }
            });
            apiLoader.load(request);
        }

        private function getMMSS(arg:Number):String {
            arg = Math.floor(arg);
            var s:Number = arg % 60;
            var m:Number = (arg - s) / 60;
            return (m < 10 ? "0" : "") + String(m) + ":" +
                (s < 10 ? "0" : "") + String(s);
        }
    }
}
