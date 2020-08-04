#!/usr/bin/env bash

set -euo pipefail

npm run-script build-readme
if git diff --name-only | grep -q -E "^README.md$"; then
    >&2 echo "README.md and its source are out of sync."
    >&2 echo "Run 'npm run-script build-readme' and add the updated README.md."
    exit 1
else
    exit 0
fi
