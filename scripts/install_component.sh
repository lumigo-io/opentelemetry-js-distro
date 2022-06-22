#!/usr/bin/env bash
pwd
pushd test/component/node || exit 1
echo "clearing..."
rm -rf node_modules package-lock.json
echo "installing packages..."
npm i
echo "done installing..."
npm run install-dependencies
popd || exit 1
