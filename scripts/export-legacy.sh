#!/bin/bash
# Export legacy validation results script with memory allocation (active tickers only by default)
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/export/export-results.js --active-only "$@"