#!/usr/bin/env bash

echo "clean"
rm -rf lib dist wrapper.tgz || true
echo "build"
npm ci
npm run build
cp package.json lib
tracer="$(npm pack)"
mv $tracer wrapper.tgz
