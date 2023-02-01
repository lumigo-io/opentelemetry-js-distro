#!/usr/bin/env bash
set -e

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout main
}

echo "Install a project with a clean state"
npm ci

echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Build tracer"
npm run build
cp package.json dist
setup_git

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
echo "Running semantic-release"
npm run semantic-release

echo "Pushing to origin/main"
git push origin main

echo "Pushing binary to logz"
source ../utils/common_bash/functions.sh
send_metric_to_logz_io type=\"Release\"
