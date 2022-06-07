#!/usr/bin/env bash

echo "I AM HERE 1 " && pwd
pushd test/integration/node
echo "I AM HERE 2 " && pwd
npm i
popd
echo "I AM HERE 3" && pwd
