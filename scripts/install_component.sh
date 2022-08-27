#!/usr/bin/env bash

function install_dependencies {
  echo "clearing..."
  rm -rf node_modules package-lock.json
  echo "installing packages..."
  npm run install-dependencies
  echo "done installing"
}

function install_component_dependencies {
  for dir in test/component/*/app
  do
    (cd "$dir" && install_dependencies)
  done
}

function install_integration_dependencies {
  for dir in test/integration/*/app
  do
    (cd "$dir" && install_dependencies)
  done
}


