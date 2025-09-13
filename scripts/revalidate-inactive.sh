#!/bin/bash
# Revalidate inactive tickers script with memory allocation
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/validate/revalidate-inactive.js