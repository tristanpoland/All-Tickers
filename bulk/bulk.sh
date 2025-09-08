#!/bin/bash

# All-Tickers Bulk Process Automation Script
# Runs the complete bulk ticker generation and validation process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
MAX_LENGTH=3
TEST_BATCH=100
DRY_RUN=false
SKIP_GENERATION=false
SKIP_VALIDATION=false
EXPORT_SHEETS=true
FORCE_YES=false

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
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

print_info() {
    echo -e "${CYAN}💡 $1${NC}"
}

# Function to show usage
show_help() {
    echo -e "${PURPLE}🚀 All-Tickers Bulk Process Script${NC}"
    echo
    echo "Usage: ./bulk.sh [options]"
    echo
    echo "Options:"
    echo "  -l, --max-length <n>    Maximum ticker length (1-5) [default: 3]"
    echo "  -t, --test-batch <n>    Test validation with N tickers first [default: 100]"
    echo "  -d, --dry-run          Show what would be done without making changes"
    echo "  -g, --skip-generation  Skip ticker generation step"
    echo "  -v, --skip-validation  Skip ticker validation step" 
    echo "  -s, --no-sheets        Skip Google Sheets export"
    echo "  -y, --yes             Auto-confirm all prompts"
    echo "  -h, --help            Show this help"
    echo
    echo "Examples:"
    echo "  ./bulk.sh                           # Quick run (3-letter tickers)"
    echo "  ./bulk.sh -l 4                      # Full coverage (4-letter tickers)"
    echo "  ./bulk.sh -d                        # Dry run to see estimates"
    echo "  ./bulk.sh -l 2 -t 50                # Small test run"
    echo "  ./bulk.sh -g -t 500                 # Skip generation, test 500 tickers"
    echo "  ./bulk.sh -v -s                     # Generate only, no validation/export"
    echo "  ./bulk.sh -y -l 4                   # Full run with auto-confirm"
    echo
    echo "Recommended strategies:"
    echo "  Quick start:     ./bulk.sh -l 3    # ~18K tickers, 7.6 hours"
    echo "  Full coverage:   ./bulk.sh -l 4    # ~475K tickers, 198 hours"
    echo "  Testing:         ./bulk.sh -d      # Preview without changes"
}

# Function to calculate estimates
calculate_estimates() {
    local length=$1
    local total_tickers=0
    
    for i in $(seq 1 $length); do
        local count=$((26**i))
        total_tickers=$((total_tickers + count))
    done
    
    local hours=$(echo "scale=1; $total_tickers * 1.5 / 3600" | bc -l)
    local days=$(echo "scale=1; $hours / 24" | bc -l)
    
    echo "$total_tickers,$hours,$days"
}

# Function to confirm with user
confirm() {
    if [ "$FORCE_YES" = true ]; then
        return 0
    fi
    
    echo -n -e "${YELLOW}$1 (y/N): ${NC}"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if npm dependencies are installed
    if [ ! -d "../node_modules" ]; then
        print_warning "Node modules not found. Running npm install..."
        (cd .. && npm install)
        if [ $? -ne 0 ]; then
            print_error "Failed to install npm dependencies"
            exit 1
        fi
    fi
    
    # Check if required files exist
    local required_files=("../ticker-database.js" "bulk-ticker-generator.js" "bulk-ticker-validator.js")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file $file not found."
            exit 1
        fi
    done
    
    # Check if bc is available for calculations
    if ! command -v bc &> /dev/null; then
        print_warning "bc (calculator) not found. Installing basic version..."
        # On macOS, bc should be available by default
    fi
    
    print_success "Prerequisites check passed"
}

# Function to show configuration and estimates
show_configuration() {
    print_step "Configuration Summary"
    
    estimates=$(calculate_estimates $MAX_LENGTH)
    IFS=',' read -r total_tickers hours days <<< "$estimates"
    
    echo "📏 Max ticker length: $MAX_LENGTH letters"
    echo "🔢 Total tickers: $(printf "%'d" $total_tickers)"
    echo "⏱️  Estimated validation time: ${hours} hours (${days} days)"
    echo "🧪 Test batch size: $(printf "%'d" $TEST_BATCH)"
    echo "🔄 Dry run mode: $DRY_RUN"
    echo "📊 Google Sheets export: $EXPORT_SHEETS"
    echo
    
    if [ "$DRY_RUN" = false ]; then
        if [ $MAX_LENGTH -ge 4 ] && [ "$FORCE_YES" = false ]; then
            print_warning "This will process $(printf "%'d" $total_tickers) tickers over ${hours} hours!"
            if ! confirm "Are you sure you want to continue?"; then
                print_info "Operation cancelled by user."
                exit 0
            fi
        fi
    fi
}

# Function to run ticker generation
run_generation() {
    if [ "$SKIP_GENERATION" = true ]; then
        print_info "Skipping ticker generation step"
        return 0
    fi
    
    print_step "Phase 1: Generating ticker combinations"
    
    local gen_args="--max-length $MAX_LENGTH"
    if [ "$DRY_RUN" = true ]; then
        gen_args="$gen_args --dry-run"
    fi
    
    echo "Running: node bulk-ticker-generator.js $gen_args"
    
    if node bulk-ticker-generator.js $gen_args; then
        print_success "Ticker generation completed"
    else
        print_error "Ticker generation failed"
        exit 1
    fi
}

# Function to run test validation
run_test_validation() {
    if [ "$SKIP_VALIDATION" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi
    
    print_step "Phase 2a: Test validation (first $TEST_BATCH tickers)"
    
    if ! confirm "Run test validation with $TEST_BATCH tickers?"; then
        print_info "Skipping test validation"
        return 0
    fi
    
    echo "Running: node bulk-ticker-validator.js --max-tickers $TEST_BATCH"
    
    if node bulk-ticker-validator.js --max-tickers $TEST_BATCH; then
        print_success "Test validation completed"
        echo
        print_info "Check the results above. If everything looks good, we'll proceed with full validation."
        if ! confirm "Continue with full validation?"; then
            print_info "Stopping after test validation as requested."
            exit 0
        fi
    else
        print_error "Test validation failed"
        exit 1
    fi
}

# Function to run full validation
run_full_validation() {
    if [ "$SKIP_VALIDATION" = true ] || [ "$DRY_RUN" = true ]; then
        print_info "Skipping validation step"
        return 0
    fi
    
    print_step "Phase 2b: Full validation (all remaining tickers)"
    
    echo "Running: node bulk-ticker-validator.js"
    
    # Run with output capture to show progress
    if node bulk-ticker-validator.js; then
        print_success "Full validation completed"
    else
        print_error "Full validation failed or was interrupted"
        print_info "Don't worry - progress has been saved. You can resume later with:"
        print_info "node bulk-ticker-validator.js"
        exit 1
    fi
}

# Function to export to Google Sheets
run_sheets_export() {
    if [ "$EXPORT_SHEETS" = false ] || [ "$DRY_RUN" = true ]; then
        print_info "Skipping Google Sheets export"
        return 0
    fi
    
    print_step "Phase 3: Exporting to Google Sheets"
    
    # Check if Google Sheets is configured
    if [ ! -f "../google-credentials.json" ] || [ ! -f "../sheets-config.json" ]; then
        print_warning "Google Sheets not configured. Skipping export."
        print_info "To set up Google Sheets, see GOOGLE-SHEETS.md"
        return 0
    fi
    
    echo "Running: node ../export-to-sheets.js"
    
    if node ../export-to-sheets.js; then
        print_success "Google Sheets export completed"
    else
        print_warning "Google Sheets export failed, but continuing..."
    fi
}

# Function to show final summary
show_summary() {
    print_step "Final Summary"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "Dry run completed - no actual changes were made"
        return 0
    fi
    
    # Get database statistics
    echo "Fetching final statistics..."
    
    # Export JSON for final stats
    (cd .. && npm run export > /dev/null 2>&1 || true)
    
    if [ -f "../output/active_tickers.json" ] && [ -f "../output/delisted_tickers.json" ]; then
        local active_count=$(cat ../output/active_tickers.json | node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
            console.log(Array.isArray(data) ? data.length : Object.keys(data).length);
        " 2>/dev/null || echo "0")
        
        local delisted_count=$(cat ../output/delisted_tickers.json | node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
            console.log(Array.isArray(data) ? data.length : Object.keys(data).length);
        " 2>/dev/null || echo "0")
        
        local total_count=$((active_count + delisted_count))
        
        echo "📊 Final Results:"
        echo "   Total tickers processed: $(printf "%'d" $total_count)"
        echo "   Active tickers found: $(printf "%'d" $active_count)"
        echo "   Delisted tickers: $(printf "%'d" $delisted_count)"
        
        if [ $active_count -gt 0 ]; then
            local hit_rate=$(echo "scale=2; $active_count * 100 / $total_count" | bc -l 2>/dev/null || echo "N/A")
            echo "   Success rate: ${hit_rate}%"
        fi
    fi
    
    echo
    print_success "🎉 Bulk process completed successfully!"
    echo
    print_info "Next steps:"
    echo "   • Check output/ folder for JSON exports"
    echo "   • View Google Sheets for live dashboard (if configured)"  
    echo "   • Run individual validation scripts for maintenance"
    echo "   • Use npm run export-sheets for manual Google Sheets updates"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--max-length)
            MAX_LENGTH="$2"
            shift 2
            ;;
        -t|--test-batch)
            TEST_BATCH="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -g|--skip-generation)
            SKIP_GENERATION=true
            shift
            ;;
        -v|--skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        -s|--no-sheets)
            EXPORT_SHEETS=false
            shift
            ;;
        -y|--yes)
            FORCE_YES=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate arguments
if [ $MAX_LENGTH -lt 1 ] || [ $MAX_LENGTH -gt 5 ]; then
    print_error "Max length must be between 1 and 5"
    exit 1
fi

if [ $TEST_BATCH -lt 1 ]; then
    print_error "Test batch size must be at least 1"
    exit 1
fi

# Main execution
main() {
    echo -e "${PURPLE}🚀 All-Tickers Bulk Process Automation${NC}"
    echo "=========================================="
    echo
    
    check_prerequisites
    show_configuration
    
    local start_time=$(date +%s)
    
    run_generation
    run_test_validation
    run_full_validation
    run_sheets_export
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local hours=$((duration / 3600))
    local minutes=$(((duration % 3600) / 60))
    
    echo
    print_step "Process completed in ${hours}h ${minutes}m"
    
    show_summary
}

# Handle interruption gracefully  
trap 'echo -e "\n${YELLOW}🛑 Process interrupted by user${NC}"; echo -e "${CYAN}💡 Progress has been saved and can be resumed${NC}"; exit 130' INT

# Run main function
main "$@"
