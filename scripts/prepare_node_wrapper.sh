#!/usr/bin/env bash

echo "clean"
echo "I AM HERE " && pwd
echo "i have here:  " && ls

rm -rf dist wrapper.tgz || true
echo "build"
npm ci
npm run build
tracer="$(npm pack)"
mv $tracer wrapper.tgz
echo "i have here 2:  " && ls
