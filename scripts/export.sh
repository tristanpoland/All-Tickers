#!/bin/bash
# Export comprehensive data script with memory allocation
cd "$(dirname "$0")/.."
node --max-old-space-size=10240 src/export/export-data.js
