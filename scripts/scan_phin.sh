#!/usr/bin/env bash

START_DIRECTORY=$1

if [ -n ${START_DIRECTORY+x} ]; then
	START_DIRECTORY="~/repos/phin"
fi

pushd $1

PRODUCTION_FOLDERS="phin-admin phin-api phin-service-network web phinternal phin-angular phin-common-js phin-web-accounts phin-advertisement-unpacker"
TOOL_FOLDERS="phin-bridge-firmware phin-bridge-firmware/src phirmware-test/nodejs phirmware-tool node-jlink phin-nrf51 node-intelhex"
#TOOL_FOLDERS=$TOOL_FOLDERS "phin-license-scanner"

FLAGS="--skipUpdate --enableUnclean"

for f in $PRODUCTION_FOLDERS; do
    if [[ -d $f ]]; then
        # $f is a directory
        echo phin-license-scanner $FLAGS -u $f
        phin-license-scanner $FLAGS -u $f
    fi
done

for f in $TOOL_FOLDERS; do
    if [[ -d $f ]]; then
        # $f is a directory
        echo phin-license-scanner $FLAGS -ud $f
        phin-license-scanner $FLAGS -ud $f
    fi
done

popd

