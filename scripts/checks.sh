#!/usr/bin/env bash

if [[ -n "$CI" ]]
then
    # Check if branch contains RD ticket value.
    echo "$GITHUB_REF" | grep -E "[RDrd]-[0-9]+|master" || { echo "Please create a relevent ticket in Jira and connect it to this branch. Use jiranch." ; exit 1; }
fi

npm run prepublishOnly