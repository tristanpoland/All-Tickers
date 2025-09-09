#!/bin/bash

# All-Tickers Processing Pipeline
# ===============================

set -e  # Exit on any error

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}🚀 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Change to src directory
cd src

print_step "Starting All-Tickers Processing Pipeline"
echo "=========================================="

# Step 1: Generate Tickers
print_step "Step 1: Generating ticker combinations..."
if node generate-tickers.js; then
    print_success "Ticker generation completed"
else
    print_error "Ticker generation failed"
    exit 1
fi

echo ""

# Step 2: Validate Tickers
print_step "Step 2: Validating tickers..."
if node validate-tickers.js; then
    print_success "Ticker validation completed"
else
    print_error "Ticker validation failed"
    exit 1
fi

echo ""

# Step 3: Export Results
print_step "Step 3: Exporting results..."
if node export-results.js; then
    print_success "Results export completed"
else
    print_error "Results export failed"
    exit 1
fi

echo ""
print_success "All-Tickers pipeline completed successfully!"

# Show final output location
if [ -d "../output" ]; then
    echo ""
    print_step "Output files created:"
    ls -la ../output/
fi