#!/bin/bash

echo "installing node container wrapper"
pwd
echo "clearing..."
rm -rf node_modules package-lock.json
echo "installing packages..."
npm i
echo "done installing..."
