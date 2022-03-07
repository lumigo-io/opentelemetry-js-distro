#!/usr/bin/env bash
set -Eeo pipefail

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout main
    # Avoid npm version failure
    git stash
}

push_tags() {
    git push origin main --tags
}

echo ".____                  .__                  .__        ";
echo "|    |    __ __  _____ |__| ____   ____     |__| ____  ";
echo "|    |   |  |  \/     \|  |/ ___\ /  _ \    |  |/  _ \ ";
echo "|    |___|  |  /  Y Y  \  / /_/  >  <_> )   |  (  <_> )";
echo "|_______ \____/|__|_|  /__\___  / \____/ /\ |__|\____/ ";
echo "        \/           \/  /_____/         \/            ";
echo

echo "Setup git"
setup_git

# node
pushd wrappers/node || exit 1

echo "Deleting old node_modules"
rm -rf node_modules

echo "Installing dependencies"
npm i

echo "Build tracer"
npm run build
npm version patch
cp package.json lib
tar -zcvf wrapper.gz lib
upload_file=$(ls ./wrapper.gz)

echo "Upload wrapper"
curl -F package=@${upload_file} https://${FURY_AUTH}@push.fury.io/lumigo/
rm -rf wrapper.gz
popd || exit 1

echo "Create release tag"
push_tags
echo "Done"
