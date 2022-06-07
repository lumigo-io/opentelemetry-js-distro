#!/bin/bash
#npm config set registry https://npm-proxy.fury.io/lumigo
echo "installing node container wrapper"
pwd
echo "clearing..."
rm -rf node_modules package-lock.json
echo "installing pakcages..."
npm i
echo "done installing..."
