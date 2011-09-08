package {
    import flash.display.Loader;
    import flash.display.Sprite;
    import flash.events.Event;
    import flash.events.TimerEvent;
    import flash.external.ExternalInterface;
    import flash.net.URLRequest;
    import flash.system.ApplicationDomain;
    import flash.system.LoaderContext;
    import flash.system.Security;
    import flash.utils.Timer;

    import tv.ustream.viewer.logic.Logic;

    public class Player extends Sprite {
        private var viewerLoader:Loader;
        private var recorded:Object;
        private var viewer:Object;
        private var start:Number;

        public function Player() {
            Security.allowDomain("*");
            viewerLoader = new Loader();
            viewerLoader.contentLoaderInfo.addEventListener(Event.COMPLETE, onRslLoad);

            this.addChild(viewerLoader);

            var applicationDomain:ApplicationDomain = ApplicationDomain.currentDomain;
            var loaderContext:LoaderContext = new LoaderContext();
            var request:URLRequest = new URLRequest("http://www.ustream.tv/flash/viewer.rsl.swf");

            loaderContext.applicationDomain = applicationDomain;
            viewerLoader.load(request, loaderContext);

            var timer1:Timer = new Timer(100);
            timer1.addEventListener(TimerEvent.TIMER, function (e:TimerEvent):void {
                if (recorded) {
                    ExternalInterface.call("momoclo.progress", recorded.time);
                }
            });
            timer1.start();

            var timer2:Timer = new Timer(2000);
            timer2.addEventListener(TimerEvent.TIMER, function (e:TimerEvent):void {
                if (recorded) {
                    recorded.play();
                    var now:Date = new Date();
                    var lag:Number = recorded.time * 1000 - (now.getTime() - start);
                    if (lag < -400) {
                        var seek:Number = (now.getTime() - start + 500) / recorded.duration / 1000;
                        recorded.seek(seek);
                    }
                    if (lag > 100) {
                        var timer:Timer = new Timer(lag, 1);
                        timer.addEventListener(TimerEvent.TIMER, function (e:TimerEvent):void {
                            recorded.play();
                        });
                        recorded.pause();
                        timer.start();
                    }
                }
            });
            timer2.start();
        }

        private function onRslLoad(e:Event):void {
            var logicClass:Class = viewerLoader.contentLoaderInfo.applicationDomain.getDefinition("tv.ustream.viewer.logic.Logic") as Class;
            viewer = new logicClass();
            viewer.display.width = this.stage.stageWidth;
            viewer.display.height = this.stage.stageHeight;

            this.addChild(viewer.display);

            ExternalInterface.addCallback("sync", onCallSync);
            ExternalInterface.call("momoclo.onFinishAddCallback");
        }

        private function onCallSync(obj:Object):void {
            if (! (recorded && recorded.mediaId === obj.vid)) {
                start = obj.start;
                recorded = viewer.createRecorded(obj.vid);
                recorded.addEventListener("finish", function (e:Event):void {
                    ExternalInterface.call("momoclo.onFinishStream");
                });
            }
            viewer.playing = true;
        }
    }
}
