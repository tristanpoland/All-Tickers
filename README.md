# All-Tickers

Generate and validate all possible stock tickers (A-ZZZZ) to discover active stocks.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the complete pipeline:**
   ```bash
   npm start
   ```

That's it! The system will generate 475,254 ticker combinations, validate them against market APIs, and export results to the `output/` directory.

## Project Structure

```
All-Tickers/
├── src/                     # Core scripts
│   ├── generate-tickers.js  # Creates ticker combinations
│   ├── validate-tickers.js  # Validates against market APIs
│   ├── export-results.js    # Exports to JSON
│   └── tickers.db          # SQLite database
├── output/                  # Results go here
│   ├── active_tickers.json  # Active stocks with prices
│   └── delisted_tickers.json # Inactive stocks
└── index.sh                # Main pipeline script
```

## Commands

```bash
# Full pipeline
npm start                    # Complete process (recommended)

# Individual steps
npm run generate            # Generate ticker combinations
npm run validate            # Validate against APIs
npm run export              # Export to JSON files

# Quick preview
npm run export:preview      # Show current statistics
```

## Output

Results are saved in the `output/` directory:
- `active_tickers.json` - Active stocks with price data
- `delisted_tickers.json` - Inactive/delisted stocks

## Features

- **Complete Coverage**: All possible tickers A-ZZZZ (475,254 combinations)
- **Real-time Data**: Yahoo Finance API for current prices and exchanges
- **Resumable**: Process can be stopped and restarted anytime
- **Fast**: Batch processing with rate limiting
- **Organized Output**: Clean JSON files with simple metadata

Expected results: ~3% active tickers (16K-17K stocks), 2-4 hours processing time.

## Support This Project

If this project saved you time or helped with your research, consider supporting the development:

**[☕ Support a starving dev for just $1 ](https://givemicahmoney.com)**

This system took quite some time to put together - your support helps maintain and improve it!
