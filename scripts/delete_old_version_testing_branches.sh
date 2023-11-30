#!/usr/bin/env bash

set -eo pipefail

today=$(date +%Y%m%d)
echo "Today: $today"
if [ "$CI" = true ]; then
    unshallow_flag="--unshallow"
fi
git fetch $unshallow_flag --force
echo "Gathering version testing branches..."
version_testing_branches=$(git branch -r | grep -E '(version-testing-[0-9]{8})' || echo "")
if [ -z "$version_testing_branches" ]; then
    echo "No version testing branches found."
    exit 0
fi
echo "Unfiltered version testing branches: $version_testing_branches"
today_branches=$(echo "$version_testing_branches" | grep "$today" || echo "")
if [ -z "$today_branches" ]; then
    echo "No version testing branch from today needs to be protected."
    branches_for_deletion=$version_testing_branches
else
    if [ "$version_testing_branches" = "$today_branches" ]; then
        echo "Today's version testing branch is the only version testing branch, aborting..."
        exit 0
    fi
    echo "Today's version testing branches: $today_branches"
    echo "Removing today's version testing branch from the list of branches to be deleted..."
    branches_for_deletion=$( \
        git branch -r \
        | grep -E '(version-testing-[0-9]{8})' \
        | grep -v "$today" \
        | awk -F'/' '{print $2}' \
    )
fi
if [ -z "$branches_for_deletion" ]; then
    echo "No version testing branches need to be deleted."
    exit 0
fi
echo "Branches marked for deletion:"
echo "$branches_for_deletion"
echo "Removing branches..."
echo "$branches_for_deletion" | xargs -I {} git push origin --delete {}
