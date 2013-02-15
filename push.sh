#!/usr/bin/env bash

zip aboutlogcat.xpi install.rdf bootstrap.js
adb push aboutlogcat.xpi /mnt/sdcard/
