#!/bin/bash
# Generate tickers script with memory allocation
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/db/generate-tickers.js
