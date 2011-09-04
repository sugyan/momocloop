#!/bin/sh
cd $(dirname $0)
svn checkout http://svn.ustream.tv/flash/rsls lib/rsls
mxmlc -load-config+=./flex-config.xml --output=./output/player.swf Player.as
