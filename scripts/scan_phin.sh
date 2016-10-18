#!/usr/bin/env bash

START_DIRECTORY=$1

if [ -n ${START_DIRECTORY+x} ]; then
	pushd $1
fi

PRODUCTION_FOLDERS="phin-admin phin-api phin-service-network web phinternal"
TOOL_FOLDERS="phin-bridge-firmware/src phirmware-test/nodejs phirmware-tool node-jlink phin-nrf51 node-intelhex phin-license-scanner"

for f in $PRODUCTION_FOLDERS; do
    if [[ -d $f ]]; then
        # $f is a directory
        echo phin-license-scanner --enableUnclean -u $f
        phin-license-scanner --enableUnclean -u $f
    fi
done

for f in $TOOL_FOLDERS; do
    if [[ -d $f ]]; then
        # $f is a directory
        echo phin-license-scanner --enableUnclean -ud $f
        phin-license-scanner --enableUnclean -ud $f
    fi
done

if [ -n ${START_DIRECTORY+x} ]; then
	popd
fi

