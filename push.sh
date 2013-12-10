#!/usr/bin/env bash

mkdir classes
javac -source 1.6 -target 1.6 -d classes -cp $HOME/android/sdk/platforms/android-17/android.jar LogcatGrabber.java
$HOME/android/sdk/platform-tools/dx --dex --verbose --output=java-code.jar classes LogcatGrabber.java
zip aboutlogcat.xpi java-code.jar install.rdf bootstrap.js icon.png options.xul
rm -rf classes java-code.jar

adb push aboutlogcat.xpi /mnt/sdcard/
