# All-Tickers Bulk System v2.0

A self-contained bulk ticker generation and validation system using SQLite database.

## Overview

This system generates all possible ticker combinations from A-ZZZZ (over 475,000 combinations), stores them in a SQLite database, validates them against real market data, and provides export functionality.

## Database Schema

```sql
CREATE TABLE tickers (
    ticker TEXT PRIMARY KEY,
    active BOOLEAN DEFAULT 0,
    price REAL DEFAULT NULL,
    exchange TEXT DEFAULT NULL
)
```

## Files

- `package.json` - Dependencies and npm scripts
- `generate-tickers.js` - Generates all ticker combinations and populates database
- `validate-tickers.js` - Validates tickers against market APIs and updates database
- `export-results.js` - Exports database contents to output/ folder (manual operation)
- `tickers.db` - SQLite database (created automatically)
- `output/` - Output directory containing:
  - `results.json` - Complete dataset with all tickers
  - `active_tickers.json` - Only active/validated tickers
  - `delisted_tickers.json` - Only inactive/delisted tickers

## Installation

```bash
cd bulk
npm install
```

## Usage

### 1. Generate Tickers
Creates the database and populates it with all possible ticker combinations (A-ZZZZ):

```bash
npm run generate
# or
node generate-tickers.js
```

This creates:
- 26 single-letter tickers (A-Z)
- 676 two-letter tickers (AA-ZZ) 
- 17,576 three-letter tickers (AAA-ZZZ)
- 456,976 four-letter tickers (AAAA-ZZZZ)
- **Total: 475,254 tickers**

### 2. Validate Tickers
Validates tickers against Yahoo Finance API and updates the database:

```bash
npm run validate
# or
node validate-tickers.js
```

Options:
- `--limit N` - Only validate N tickers
- `--dry-run` - Show what would be validated without making changes

Examples:
```bash
node validate-tickers.js --limit 1000    # Validate only 1000 tickers
node validate-tickers.js --dry-run       # Preview mode
```

### 3. Export Results
Manually export database contents to output/ folder with separate files:

```bash
npm run export           # Export all files (complete, active, delisted)
# or
node export-results.js   # Default: creates all three files
```

Export Options:
- `--active-only` - Export only active_tickers.json
- `--delisted-only` - Export only delisted_tickers.json  
- `--complete-only` - Export only complete results.json
- `--preview` - Show statistics without exporting

Examples:
```bash
npm run export:active              # Only active tickers
npm run export:delisted            # Only delisted tickers
npm run export:preview             # Preview statistics
node export-results.js --complete-only  # Only complete dataset
```

## Output Files

The system creates three separate JSON files in the `output/` folder:

### 1. `active_tickers.json`
Contains only validated active tickers with prices and exchange information.

### 2. `delisted_tickers.json` 
Contains all inactive/delisted tickers (active = false).

### 3. `results.json`
Complete dataset with all tickers (active and inactive) - only created with default export or --complete-only.

## Output Format

Each JSON file contains structured data with metadata, statistics, and ticker arrays:

```json
{
  "metadata": {
    "exportDate": "2025-09-08T20:00:00.000Z",
    "exportType": "active|delisted|complete",
    "version": "2.0.0",
    "description": "All-Tickers bulk validation results"
  },
  "statistics": {
    "total": 475254,
    "active": 1523,
    "inactive": 473731,
    "validated": 475254,
    "validationRate": "100%",
    "activeRate": "0.3%",
    "priceStats": {
      "average": 45.67,
      "minimum": 0.01,
      "maximum": 1234.56
    }
  },
  "exchanges": [
    {
      "name": "NASDAQ",
      "tickerCount": 856,
      "averagePrice": 52.34
    }
  ],
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

## Performance Notes

- **Generation**: Creates ~475K tickers in seconds
- **Validation**: Processes in batches with delays to respect API limits
- **Storage**: SQLite provides efficient storage and querying
- **Export**: Can export all data or filter to active tickers only

## API Rate Limiting

The validation script includes built-in rate limiting:
- Processes tickers in batches of 100
- 1-second delay between batches
- 100ms delay between individual ticker validations
- Respectful error handling for API limits

## Self-Contained Design

This bulk system is completely self-contained within the `bulk/` folder:
- Own `package.json` with specific dependencies
- Own SQLite database
- No dependencies on parent directory files
- Manual export process (not automated)

## Dependencies

- `sqlite3` - SQLite database driver
- `axios` - HTTP requests for API validation

## Commands Summary

```bash
# Setup
npm install

# Generate all ticker combinations
npm run generate

# Validate tickers (all)
npm run validate

# Validate limited number
node validate-tickers.js --limit 1000

# Export all files (active, delisted, complete)
npm run export

# Export specific files
npm run export:active        # Only active tickers
npm run export:delisted      # Only delisted tickers  
npm run export:preview       # Show statistics only

# Export with specific options
node export-results.js --complete-only   # Only complete dataset
node export-results.js --preview         # Preview statistics
```
