#!/usr/bin/env bash
set -Eeo pipefail

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout master
    # Avoid npm version failure
    git stash
}

push_tags() {
    git push origin master --tags
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

echo "bump version"
changes=$(git log $(git describe --tags --abbrev=0)..HEAD --oneline)
sudo pip install --upgrade bumpversion
bumpversion patch --message "{current_version} → {new_version}. Changes: ${changes}"

echo "Uploading lumigo_wrapper to gemfury (python)"
pushd wrappers/python || exit 1
python setup.py sdist
upload_file=$(ls ./dist/*.gz)
curl -F package=@${upload_file} https://${FURY_AUTH}@push.fury.io/lumigo/
popd || exit 1

# node
pushd wrappers/node || exit 1
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
