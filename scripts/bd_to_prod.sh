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

echo "Build tracer"
npm run build
npm version patch
cp package.json lib
cd lib


echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Creating new credential files"
enc_location=../common-resources/encrypted_files/credentials_production.enc
if [[ ! -f ${enc_location} ]]
then
    echo "$enc_location not found"
    exit 1
fi

mkdir -p ~/.aws
echo ${KEY} | gpg --batch -d --passphrase-fd 0 ${enc_location} > ~/.aws/credentials

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm run semantic-release

echo \{\"type\":\"Release\",\"repo\":\"${CIRCLE_PROJECT_REPONAME}\",\"buildUrl\":\"${CIRCLE_BUILD_URL}\"\} | curl -X POST "https://listener.logz.io:8071?token=${LOGZ}" -v --data-binary @-
git push origin master
