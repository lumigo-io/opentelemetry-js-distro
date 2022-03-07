#!/usr/bin/env bash
set -e

echo "Deleting old node_modules"
rm -rf node_modules

echo "Installing dependencies"
npm i

echo "Build tracer"
npm run build

echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Getting latest changes from git"
changes=$(git log $(git describe --tags --abbrev=0)..HEAD --oneline)
echo ${changes}