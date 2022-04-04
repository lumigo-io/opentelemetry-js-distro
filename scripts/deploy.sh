#!/usr/bin/env bash
set -e

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout master
}

echo "Install a project with a clean state"
npm ci

echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Build tracer"
npm run build
cp package.json lib
setup_git

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm run semantic-release

echo \{\"type\":\"Release\",\"repo\":\"${CIRCLE_PROJECT_REPONAME}\",\"buildUrl\":\"${CIRCLE_BUILD_URL}\"\} | curl -X POST "https://listener.logz.io:8071?token=${LOGZ}" -v --data-binary @-
git push origin master