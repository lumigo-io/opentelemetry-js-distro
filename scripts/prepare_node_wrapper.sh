#!/usr/bin/env bash

echo "clean"

rm -rf dist wrapper.tgz || true
echo "build"
npm ci
npm run build
tracer="$(npm pack)"
mv "$tracer" wrapper.tgz
