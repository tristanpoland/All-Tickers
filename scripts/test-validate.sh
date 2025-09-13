#!/bin/bash
# Validate tickers with limit for testing
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/validate/validate-tickers.js --limit 100 --dry-run