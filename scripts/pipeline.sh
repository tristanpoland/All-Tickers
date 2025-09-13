#!/bin/bash
# Complete pipeline script - runs all steps with memory allocation
set -e  # Exit on any error

cd "$(dirname "$0")/.."

echo "🚀 Starting All-Tickers Complete Pipeline"
echo "==========================================="

echo ""
echo "📊 Step 1: Generating ticker combinations..."
node --max-old-space-size=10240 src/db/generate-tickers.js

echo ""
echo "🔍 Step 2: Validating tickers..."
node --max-old-space-size=10240 src/validate/validate-tickers.js

echo ""
echo "✅ Step 3: Revalidating active tickers..."
node --max-old-space-size=10240 src/validate/revalidate-active.js

echo ""
echo "🔄 Step 4: Revalidating inactive tickers..."
node --max-old-space-size=10240 src/validate/revalidate-inactive.js

echo ""
echo "📈 Step 5: Collecting comprehensive data..."
node --max-old-space-size=10240 src/return-data/return-data.js

echo ""
echo "💾 Step 6: Exporting data to JSON/CSV..."
node --max-old-space-size=10240 src/export/export-data.js

echo ""
echo "🎉 Pipeline completed successfully!"
echo "📁 Check the output/ directory for results"