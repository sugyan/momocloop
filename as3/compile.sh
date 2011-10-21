#!/bin/sh
cd $(dirname $0)
svn checkout http://svn.ustream.tv/flash/rsls lib/rsls
mxmlc -compiler.define=PROGRAM::type,"'live'" -load-config+=./flex-config.xml -output=./output/livePlayer.swf Player.as
mxmlc -compiler.define=PROGRAM::type,"'talk'" -load-config+=./flex-config.xml -output=./output/talkPlayer.swf Player.as
