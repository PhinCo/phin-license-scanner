#!/usr/bin/env bash

pushd $1

ADDITIONAL_FOLDERS="phin-bridge-firmware/src phirmware-test/nodejs"

for f in * $ADDITIONAL_FOLDERS; do
    if [[ -d $f ]]; then
        # $f is a directory
        echo Entering $f
        pushd $f
        phin-license-scanner .
        popd
        echo Leaving $f
    fi
done

popd