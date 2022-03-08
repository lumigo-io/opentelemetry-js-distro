#!/usr/bin/env bash
set -e

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout master
}

echo "Install a project with a clean state"
npm ci

echo "Setup git"
setup_git
ls
echo "clean"
rm -rf lib dist node_modules

echo "Build node wrapper"
npm i
npm run build
npm version patch
cp package.json lib
cp package-lock.json lib
pushd lib
npm i
echo ls1
ls
echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm run semantic-release

echo \{\"type\":\"Release\",\"repo\":\"${CIRCLE_PROJECT_REPONAME}\",\"buildUrl\":\"${CIRCLE_BUILD_URL}\"\} | curl -X POST "https://listener.logz.io:8071?token=${LOGZ}" -v --data-binary @-
git push origin master
popd
