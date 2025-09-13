#!/bin/bash
# Revalidate active tickers script with memory allocation
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/validate/revalidate-active.js