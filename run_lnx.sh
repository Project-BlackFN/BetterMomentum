#!/bin/sh

npm install
npm install -g typescript
tsc

echo ""
echo "+---------------------------------------------------+"
echo "|                Installation Finished!             |"
echo "+---------------------------------------------------+"
echo ""

read -p "Press any key to continue..." -n1 -s
echo ""
