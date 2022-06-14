#!/usr/bin/env bash

pushd src/test/component/node || exit 1
npm run install-dependencies
popd || exit 1
