# All-Tickers

A comprehensive ticker generation and validation system for discovering active stock tickers from all possible letter combinations (A-ZZZZ).

## 🏗️ Project Structure

```
All-Tickers/
├── src/                           # Core application files
│   ├── generate-tickers.js       # Generates all ticker combinations (A-ZZZZ)
│   ├── validate-tickers.js       # Validates tickers against market APIs
│   ├── export-results.js         # Exports results to JSON files
│   └── tickers.db                # SQLite database (auto-generated)
├── output/                        # Export results directory
│   ├── active_tickers.json       # Active tickers with price data
│   └── delisted_tickers.json     # Inactive/delisted tickers
├── index.sh                       # Main pipeline script (runs all steps)
├── package.json                   # Dependencies and npm scripts
└── node_modules/                  # Dependencies

Legacy/Development:
├── bulk/                          # Alternative bulk processing system
└── [various legacy scripts]       # Original development files
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Complete Pipeline

**Option A: Direct Script**
```bash
./index.sh
```

**Option B: NPM Command**
```bash
npm start
# or
npm run pipeline
```

This automated pipeline will:
1. 📊 **Generate**: Create 475,254 ticker combinations (A-ZZZZ)
2. 🔍 **Validate**: Check each ticker against market APIs  
3. 📤 **Export**: Create JSON files in `output/` directory

### 3. NPM Commands (Recommended)

```bash
# Complete pipeline
npm start                    # Run full pipeline (./index.sh)
npm run pipeline            # Alternative to npm start

# Individual steps
npm run generate            # Generate ticker combinations
npm run validate            # Validate tickers against APIs
npm run export              # Export all results

# Export variations
npm run export:active       # Export only active tickers
npm run export:preview      # Preview statistics without export

# Testing
npm run test:validate       # Dry run validation (100 tickers)
```

### 4. Manual Step-by-Step
```bash
cd src

# Step 1: Generate all ticker combinations
node generate-tickers.js

# Step 2: Validate tickers (resumable process)
node validate-tickers.js

# Step 3: Export results
node export-results.js
```

## 📊 System Overview

### Database Schema
```sql
CREATE TABLE tickers (
    ticker TEXT PRIMARY KEY,
    active BOOLEAN DEFAULT 0,
    price REAL DEFAULT NULL,
    exchange TEXT DEFAULT NULL
)
```

### Ticker Generation
- **1-letter**: 26 tickers (A-Z)
- **2-letter**: 676 tickers (AA-ZZ) 
- **3-letter**: 17,576 tickers (AAA-ZZZ)
- **4-letter**: 456,976 tickers (AAAA-ZZZZ)
- **Total**: 475,254 possible combinations

### Validation Process
- Uses Yahoo Finance API for real-time data
- Batch processing with rate limiting
- **Resumable**: Automatically continues from where it left off
- Records price, exchange, and active status

## 📁 Output Files

All results are exported to the `output/` directory:

### `active_tickers.json`
Contains validated active tickers with market data:
```json
{
  "metadata": {
    "exportDate": "2025-09-09T12:00:00.000Z",
    "exportType": "active",
    "version": "2.0.0"
  },
  "statistics": {
    "active": 2015,
    "activeRate": "22%",
    "averagePrice": 65.33
  },
  "tickers": [
    {
      "ticker": "AAPL",
      "active": true,
      "price": 150.25,
      "exchange": "NASDAQ"
    }
  ]
}
```

### `delisted_tickers.json`
Contains inactive/delisted tickers for reference.

## ⚡ Performance & Features

### Speed Optimization
- **SQLite database**: Fast storage and querying
- **Batch processing**: Efficient API usage
- **Rate limiting**: Respectful to market data providers
- **Concurrent requests**: Multiple simultaneous validations

### Resume Capability
The validation process is fully resumable:
- Database tracks validation progress
- Restart anytime without losing work
- Smart detection of unprocessed tickers

### Export Options
```bash
# Export active tickers only
node export-results.js --active-only

# Preview statistics without exporting
node export-results.js --preview

# Export from src directory
cd src && node export-results.js
```

## 🔧 Advanced Usage

### Validate Limited Set
```bash
# Using npm (recommended)
npm run test:validate             # Dry run with 100 tickers

# Manual approach
cd src
node validate-tickers.js --limit 1000    # Validate only 1000 tickers
node validate-tickers.js --dry-run       # Preview mode
```

### Check Progress
```bash
# Using npm
npm run export:preview            # See current statistics

# Manual approach
cd src
node export-results.js --preview         # See current statistics
```

### Resume Validation
Simply run the validation command again - it automatically resumes:
```bash
# Using npm
npm run validate                  # Continues from last position

# Manual approach
cd src
node validate-tickers.js                 # Continues from last position
```

## 📈 Expected Results

Based on validation runs:
- **Success Rate**: ~20-25% of tickers are active
- **Processing Speed**: 40+ tickers per second
- **Total Active Tickers**: Estimated 95,000-119,000 active tickers
- **Completion Time**: 2-4 hours for full validation

## 🛠️ Dependencies

- `sqlite3` - Database storage
- `axios` - HTTP requests for market data

## 📋 Commands Reference

### NPM Commands (Recommended)
```bash
# Complete pipeline
npm start                    # Run full pipeline
npm run pipeline            # Alternative to npm start

# Individual steps
npm run generate            # Generate ticker combinations
npm run validate            # Validate against market APIs
npm run export              # Export all results to JSON

# Export options
npm run export:active       # Export only active tickers
npm run export:preview      # Show statistics without exporting

# Testing/Development
npm run test:validate       # Dry run validation (100 tickers)
```

### Direct Commands
```bash
# Full pipeline
./index.sh                  # Run complete automated pipeline

# Manual steps (from src directory)
cd src
node generate-tickers.js    # Generate ticker combinations
node validate-tickers.js    # Validate against market APIs  
node export-results.js      # Export to JSON files

# Export variations
node export-results.js --active-only    # Active tickers only
node export-results.js --preview        # Statistics preview

# Validation options  
node validate-tickers.js --limit 500    # Validate specific amount
node validate-tickers.js --dry-run      # Preview validation
```

## 🎯 Use Cases

- **Stock research**: Discover lesser-known active tickers
- **Market analysis**: Complete dataset of all possible tickers
- **Trading algorithms**: Comprehensive ticker universe
- **Data science**: Large-scale financial data collection
