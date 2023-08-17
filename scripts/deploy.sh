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

echo "Dry-run of semantic-version to determine whether the package will be published"
# merge stderr and stdout and check for "no new version is released". If found, bail.
# don't forget to capture the grep failure with `|| echo ""` so that the script doesn't fail
# when the line isn't found
npm run semantic-release -- -d 2>&1 | grep "no new version is released" > no_new_version.txt || echo "It looks like a new version will be released!"
if [ -s no_new_version.txt ]; then
    # run the dry run a second time so that the output is printed to the console
    echo npm run semantic-release -- -d
    echo ""
    echo "Marking deployment as failed as no new version would be released."
    exit 1
fi

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
echo "Running semantic-release"
npm run semantic-release

echo "Pushing to origin/main"
git push origin main

echo "Pushing binary to logz"
source ../utils/common_bash/functions.sh
send_metric_to_logz_io type=\"Release\"
