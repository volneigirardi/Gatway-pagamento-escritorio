#!/bin/sh
set -e
apk add --no-cache postgresql18-client
node --experimental-strip-types database/scripts/backup.ts
echo "SCRIPT_EXIT_CODE=$?"
