#!/bin/bash

# NYSE Export Alias Script
# Run from main All-Tickers directory

echo "🏛️  Exporting NYSE tickers..."
node src/export-advanced/export-nyse-results.js "$@"
