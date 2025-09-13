# All-Tickers

Generate and validate all possible stock tickers (A-ZZZZ) to discover active stocks with comprehensive financial data collection and export capabilities.

## Quick Start

1. **Install dependencies:**
   ```
   npm install
   or
   npm i
   ```

2. **Run the complete pipeline:**
   ```
   npm run pipeline
   ```

That's it! The system will generate ticker combinations, validate them against market APIs, collect comprehensive financial data, and export results to JSON/CSV in the `output/` directory.

## Pipeline Overview

The complete pipeline consists of 6 automated steps:

1. **Generate Tickers** → Creates all possible ticker combinations (A-ZZZZ)
2. **Validate Tickers** → Tests each ticker against Yahoo Finance API
3. **Revalidate Active** → Double-checks active tickers for accuracy
4. **Revalidate Inactive** → Catches any missed active tickers  
5. **Collect Data** → Gathers comprehensive financial data for active tickers
6. **Export Data** → Outputs structured JSON and CSV files

## Project Structure

```
All-Tickers/
├── scripts/                      # NPM script wrappers with memory allocation
│   ├── generate.sh               # Generate ticker combinations
│   ├── validate.sh               # Initial validation
│   ├── revalidate-active.sh      # Active ticker revalidation (24h skip logic)
│   ├── revalidate-inactive.sh    # Inactive ticker revalidation (24h skip logic)
│   ├── gather.sh                 # Comprehensive data collection
│   ├── export.sh                 # Comprehensive JSON/CSV export (streaming)
│   ├── export-legacy.sh          # Simple validation data export
│   ├── export-nyse.sh            # NYSE-specific ticker export
│   ├── test-validate.sh          # Test validation with limits
│   └── pipeline.sh               # Complete 6-step pipeline
├── src/
│   ├── db/
│   │   ├── generate-tickers.js    # Step 1: Generate ticker combinations
│   │   ├── tickers.db            # Main validation database
│   │   └── ticker_data.db        # Comprehensive financial data
│   ├── validate/
│   │   ├── validate-tickers.js    # Step 2: Initial validation
│   │   ├── revalidate-active.js   # Step 3: Active ticker revalidation
│   │   └── revalidate-inactive.js # Step 4: Inactive ticker revalidation
│   ├── return-data/
│   │   └── return-data.js         # Step 5: Comprehensive data collection
│   └── export/
│       ├── export-data.js         # Step 6: JSON/CSV export
│       ├── export-results.js      # Legacy validation exports
│       └── export-nyse-results.js # NYSE-specific exports
├── output/                        # All results saved here
│   ├── DATA.json                 # Comprehensive financial data (JSON)
│   ├── DATA.csv                  # Comprehensive financial data (CSV) 
│   ├── active_tickers.json       # Simple active ticker list
│   └── delisted_tickers.json     # Simple inactive ticker list
├── index.sh                      # Main pipeline script
└── package.json                  # Dependencies and scripts
```

## Script Summary

### **Available Scripts (10 total):**

#### **Core Pipeline Scripts (6):**
- **`generate.sh`** - Generate all possible ticker combinations (A-ZZZZ)
- **`validate.sh`** - Initial validation against Yahoo Finance API
- **`revalidate-active.sh`** - Re-check active tickers (with 24h skip logic)
- **`revalidate-inactive.sh`** - Re-check inactive tickers (with 24h skip logic)  
- **`gather.sh`** - Collect comprehensive financial data for active tickers
- **`export.sh`** - Export comprehensive data to JSON/CSV (streaming)

#### **Specialized Export Scripts (2):**
- **`export-legacy.sh`** - Export simple validation data (ticker, price, status)
- **`export-nyse.sh`** - Export NYSE/NASDAQ tickers only

#### **Utility Scripts (2):**
- **`test-validate.sh`** - Test validation with limited ticker batch
- **`pipeline.sh`** - Run complete 6-step pipeline sequence

### **Key Features:**
- ✅ **Memory Optimized**: All scripts use `--max-old-space-size=10240` (10GB)
- ✅ **24-Hour Skip Logic**: Revalidation scripts avoid recently checked tickers
- ✅ **Streaming Exports**: Handle large datasets without memory issues
- ✅ **Constant crumb updates**: Updates a new crumb every 10000 tickers to make sure 
- ✅ **Clean Organization**: No duplicate scripts, single purpose each

## Commands

### Primary Commands (With Memory Allocation)
```bash
# Complete pipeline (recommended)
./index.sh                  # Full 6-step process with progress tracking
npm start                   # Same as above
npm run pipeline            # Alternative complete pipeline script

# Individual pipeline steps (all include --max-old-space-size=10240)
npm run generate            # Step 1: Generate ticker combinations  
npm run validate            # Step 2: Initial validation
npm run revalidate-active   # Step 3: Revalidate active tickers (24h skip)
npm run revalidate-inactive # Step 4: Revalidate inactive tickers (24h skip)
npm run gather              # Step 5: Collect comprehensive data
npm run export              # Step 6: Export to JSON/CSV (streaming)
```

### Legacy/Specialized Commands
```bash
# Legacy validation exports (simple ticker data with memory allocation)
npm run export-legacy              # Export active tickers only (memory-safe)
npm run test-validate              # Test validation with 100 ticker limit

# Specialized exports (with memory allocation)  
npm run export-nyse                # NYSE tickers only

# Note: Legacy exports focus on active tickers to avoid memory issues with 12M+ records
```

### Direct Script Access
```bash
# All scripts include proper memory allocation (--max-old-space-size=10240)
./scripts/generate.sh              # Generate ticker combinations
./scripts/validate.sh              # Validate tickers against market APIs  
./scripts/revalidate-active.sh     # Revalidate active tickers (24h skip)
./scripts/revalidate-inactive.sh   # Revalidate inactive tickers (24h skip)
./scripts/gather.sh                # Collect comprehensive financial data
./scripts/export.sh                # Export comprehensive data (streaming)
./scripts/export-legacy.sh         # Export simple validation data
./scripts/export-nyse.sh           # Export NYSE-specific data
./scripts/test-validate.sh         # Test validation (limited batch)
./scripts/pipeline.sh              # Complete pipeline sequence
```

## Output Files

### Comprehensive Data (Primary Output)
- **`DATA.json`** - Complete financial data with metadata structure
- **`DATA.csv`** - Same data in spreadsheet format for analysis

### Legacy Validation Output
- **`active_tickers.json`** - Simple list of active tickers with basic prices
- **`delisted_tickers.json`** - List of inactive/delisted tickers

### Specialized Output
- **`nyse_tickers.json`** - NYSE/NASDAQ tickers only 
- **`nyse_tickers.csv`** - NYSE tickers in CSV format

## Features

### Core Capabilities
- **Complete Coverage**: All possible tickers A-ZZZZZ (12.3 million combinations when fully enabled)
- **Intelligent Rate Limiting**: Respects Yahoo Finance API limits with smart delays
- **Resumable Processing**: Can stop and restart at any point
- **Smart Caching**: Avoids reprocessing recently updated data (24-hour skip logic)
- **Memory Efficient**: All scripts include 10GB heap allocation (`--max-old-space-size=10240`)
- **Streaming Exports**: Handles large datasets without memory issues
- **24-Hour Revalidation**: Skips recently checked tickers to optimize performance

### Data Collection
- **Real-time Quotes**: Current prices, market cap, P/E ratios
- **Historical Data**: Price history and volume data  
- **Company Information**: Sector, industry, exchange information
- **Financial Metrics**: Dividend yields, 52-week ranges, statistics

### Export Formats
- **Structured JSON**: Hierarchical data with metadata
- **CSV Spreadsheets**: Flat format for analysis tools
- **Streaming Support**: Handles large datasets without memory issues

## Performance & Scale

- **Current Config**: Single-letter tickers only (A-Z = 26 tickers)
- **Full Scale**: Enable 2-4 letter combinations for ~475K tickers
- **Processing Time**: ~2-4 hours for full dataset (with rate limiting)
- **Expected Results**: ~3% active tickers (15K-17K stocks at full scale)
- **Memory Usage**: 10GB heap allocation for large dataset processing

## Configuration

To enable full ticker generation, edit `src/db/generate-tickers.js` and uncomment the 2, 3, and 4-letter ticker generation sections.

## Support This Project

If this project saved you time or helped with your research, consider supporting the development:

**[☕ Support a starving dev for just $1](https://givemicahmoney.com)**

This comprehensive financial data collection system took significant time to build - your support helps maintain and improve it!
