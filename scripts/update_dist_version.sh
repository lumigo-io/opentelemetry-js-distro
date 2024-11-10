#!/bin/bash

# Expected to come from running the script with `nextRelease.version` during a semantic-release hook run
next_version=$1

pushd ./dist
if [ ! -f "package.json" ]; then
  echo "File dist/package.json found."
  exit 1
fi

jq ".version = \"$next_version\"" package.json > package.tmp.json && mv package.tmp.json package.json
popd