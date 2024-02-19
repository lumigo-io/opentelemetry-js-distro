#!/usr/bin/env bash

PACKAGE_NAME="$1"
SUPPORTED_VERSIONS=(14 16 18 20)

if [ -z "$PACKAGE_NAME" ]; then
    echo "Usage: $0 <PACKAGE_NAME>"
    exit 1
fi

base_folder="src/instrumentations/${PACKAGE_NAME}/tested_versions"
test_folder="src/test/integration/${PACKAGE_NAME}"

echo "Creating tested versions folders under ${base_folder}..."
for version in "${SUPPORTED_VERSIONS[@]}"; do
    echo "Creating ${version} folder..."
    version_folder="${base_folder}/${version}"
    mkdir -p "$version_folder"
    touch "${version_folder}/${PACKAGE_NAME}"
done

echo ""
echo "Creating tested versions symlink in ${test_folder}..."
mkdir -p "$test_folder"
pushd "$test_folder"
    if [ -e tested_versions ]; then
        echo "Removing old tested_versions symlink..."
        rm tested_versions
    fi
    echo "linking from ${test_folder} to ${base_folder}..."
    ln -s ../../../../${base_folder} tested_versions
popd

echo ""
echo "Done"
