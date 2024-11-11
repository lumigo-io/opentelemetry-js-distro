#!/bin/bash

next_version=$1

pushd ./dist
if [ ! -f "package.json" ]; then
  echo "No dist/package.json found, failing deployment!"
  exit 1
fi

jq ".version = \"$next_version\"" package.json > package.tmp.json && mv package.tmp.json package.json
popd