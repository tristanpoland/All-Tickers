#!/bin/bash
# Export NYSE results script with memory allocation
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/export/export-nyse-results.js "$@"