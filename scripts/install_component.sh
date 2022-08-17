#!/usr/bin/env bash
function install_dependencies {
  echo "clearing..."
  rm -rf node_modules package-lock.json
  echo "installing packages..."
  npm run install-dependencies
  echo "done installing"
}

for dir in test/component/http/app test/integration/express/app
do
  (cd "$dir" && install_dependencies)
done

