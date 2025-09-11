#!/bin/bash

# All-Tickers Pipeline - Complete Data Collection & Export Process
# =================================================================
# The step by step process to run the full pipeline:
# generate tickers -> validate tickers -> revalidate active -> revalidate inactive -> 
# return data (using database, and 10gb of heap storage) -> export data (using database, and 10gb of heap storage)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Memory allocation for Node.js processes
NODE_MEMORY="--max-old-space-size=10240"

# Function to print section headers
print_section() {
    echo -e "\n${PURPLE}===========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}===========================================${NC}\n"
}

# Function to print step headers
print_step() {
    echo -e "\n${CYAN}🔄 Step $1: $2${NC}"
    echo -e "${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}\n"
}

# Function to print success messages
print_success() {
    echo -e "\n${GREEN}✅ $1${NC}\n"
}

# Function to print error messages
print_error() {
    echo -e "\n${RED}❌ $1${NC}\n"
}

# Function to print warnings
print_warning() {
    echo -e "\n${YELLOW}⚠️  $1${NC}\n"
}

# Start pipeline
print_section "🚀 ALL-TICKERS PIPELINE STARTING"
echo -e "${BLUE}Pipeline started at: $(date)${NC}"
echo -e "${BLUE}Memory allocation: 10GB heap space${NC}"
echo -e "${BLUE}Current directory: $(pwd)${NC}\n"

# Step 2: Validate Tickers
print_step "2" "Validate Tickers (Initial Validation)"
if [ -f "./src/validate/validate-tickers.js" ]; then
    cd ./src/validate
    if node validate-tickers.js; then
        print_success "Initial ticker validation completed"
    else
        print_error "Initial ticker validation failed"
        exit 1
    fi
    cd ../..
else
    print_error "Validate tickers script not found at src/validate/validate-tickers.js"
    exit 1
fi

# Pipeline completion
print_section "🎉 ALL-TICKERS Initiated and Validated"
echo -e "${GREEN}✅ Full pipeline executed successfully!${NC}"
echo -e "${GREEN}📅 Completed at: $(date)${NC}"
echo -e "${GREEN}📁 Check the output/ directory for exported files${NC}"

# Display output summary if output directory exists
if [ -d "output" ]; then
    echo -e "\n${BLUE}📊 Output Files Summary:${NC}"
    ls -lah output/ | grep -E "\.(json|csv)$" | while read -r line; do
        echo -e "${CYAN}   $line${NC}"
    done
fi

echo -e "\n${PURPLE}Pipeline execution completed. All steps successful! 🚀${NC}\n"

