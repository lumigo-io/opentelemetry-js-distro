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

echo "Publish to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
echo "Running semantic-release"

# merge stderr and stdout so we can examine the logs if the command fails logically but doesn't return a non-zero exit code
npm run semantic-release 2>&1 | tee semantic_release_logs.txt

if grep -q "npm ERR! Exit status" semantic_release_logs.txt; then
    echo "semantic-release failed, see details above"
    exit 1
fi

if grep -q "no new version is released" semantic_release_logs.txt; then
    echo "Marking deployment as failed, as no new version would be released."
    exit 1
fi

echo "Pushing to origin/main"
git push origin main

echo "Pushing binary to logz"
source ../utils/common_bash/functions.sh
send_metric_to_logz_io type=\"Release\"
