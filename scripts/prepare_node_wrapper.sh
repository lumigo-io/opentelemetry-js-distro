pushd wrappers/node || exit 1
echo "clean"
rm -rf lib dist node_modules wrapper.tgz wrapper.gz

echo "build..."
npm i
npm run build
cp package.json lib

# NPM
wrapper="$(npm pack | tail -1)"
mv $wrapper wrapper.tgz

popd