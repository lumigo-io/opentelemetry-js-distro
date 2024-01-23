#!/bin/bash

set -eu

readonly SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]:-$0}"; )" &> /dev/null && pwd 2> /dev/null; )";
readonly ROOT_DIR="$(dirname ${SCRIPT_DIR})"

echo "feat: Test additional package versions [auto-test-update]"

git diff --name-only -- "${ROOT_DIR}/src/" | \
    sort | \
    while read -r modified_version_file; do \
        package_name=$(basename "${modified_version_file}")
        runtime_path=$(dirname "${modified_version_file}")
        runtime=$(basename "${runtime_path}")
        new_versions=$(git diff HEAD --no-ext-diff --unified=0 --exit-code -a --no-prefix -- ${modified_version_file} | egrep "^\+" | tail -n +2 | sed 's/\+\(.*\)/\1/' | tr '\n' ' ')
        echo "${package_name} (${runtime}): ${new_versions}"
    done
