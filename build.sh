rm -rf dist *.tgz && \
  tsc --build --force

mkdir -p dist/scripts/hooks && \
  cp -r scripts/hooks/postinstall dist/scripts/hooks/

tracer=$(npm pack) && \
  mv $tracer distro.tgz && \
  cp distro.tgz wrapper.tgz