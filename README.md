# All-Tickers

Generate and validate all possible stock tickers (A-ZZZZ) to discover active stocks with comprehensive financial data collection and export capabilities.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the complete pipeline:**
   ```bash
   ./index.sh
   # or
   npm start
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

## Commands

### Primary Commands
```bash
# Complete pipeline (recommended)
./index.sh                  # Full 6-step process with progress tracking
npm start                   # Same as above

# Individual pipeline steps
cd src/db && node generate-tickers.js          # Step 1: Generate tickers
cd src/validate && node validate-tickers.js    # Step 2: Validate tickers  
cd src/validate && node revalidate-active.js   # Step 3: Revalidate active
cd src/validate && node revalidate-inactive.js # Step 4: Revalidate inactive
cd src/return-data && node return-data.js      # Step 5: Collect data
cd src/export && node export-data.js           # Step 6: Export data
```

### Legacy/Specialized Commands
```bash
# Legacy validation exports
npm run export              # Export validation results to JSON
npm run export:preview      # Preview current validation statistics

# Specialized exports  
cd src/export && node export-nyse-results.js           # NYSE tickers only
cd src/export && node export-nyse-results.js --preview # Preview NYSE data
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
- **Complete Coverage**: All possible tickers A-ZZZZ (475,254 combinations when fully enabled)
- **Intelligent Rate Limiting**: Respects Yahoo Finance API limits with smart delays
- **Resumable Processing**: Can stop and restart at any point
- **Smart Caching**: Avoids reprocessing recently updated data
- **Memory Efficient**: Streaming exports for large datasets (10GB heap allocation)

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
