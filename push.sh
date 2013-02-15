#!/usr/bin/env bash

mkdir classes
javac -source 1.6 -target 1.6 -d classes LogcatGrabber.java
$HOME/android/sdk/platform-tools/dx --dex --verbose --output=java-code.jar classes
zip aboutlogcat.xpi java-code.jar install.rdf bootstrap.js
rm -rf classes java-code.jar

adb push aboutlogcat.xpi /mnt/sdcard/
