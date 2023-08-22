#!/usr/bin/env bash

if [[ -n "$CIRCLECI" ]]
then
    npm run prettier:ci
else
    npm run prettier:fix
fi
