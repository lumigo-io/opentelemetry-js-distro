#!/bin/bash

echo "installing node container wrapper"
pwd
echo "clearing..."
rm -rf node_modules package-lock.json

# Install the Lumigo Distro for OpenTelemetry from local
echo "installing the Lumigo Distro for OpenTelemetry from local..."
npm i --install-links

# Install the other dependencies
echo "installing other dependencies..."
npm i
echo "done installing..."
