# Advanced Export Scripts

This directory contains specialized export scripts for filtering and exporting ticker data by specific criteria.

## 🏛️ NYSE Export Script

**File**: `export-nyse-results.js`

Exports only tickers that are available on major US stock exchanges (NYSE, NASDAQ NMS, etc.).

### Usage:

```bash
# Export both JSON and CSV formats
node export-nyse-results.js

# Preview NYSE data without creating files
node export-nyse-results.js --preview

# Export only JSON format
node export-nyse-results.js --csv-only

# Export only CSV format
node export-nyse-results.js --json-only
```

### Output Files:

- **`nyse_tickers.json`** - Complete NYSE ticker data with metadata and statistics
- **`nyse_tickers.csv`** - NYSE tickers in spreadsheet format (ticker, exchange, price, active)

### Included Exchanges:

- **NYQ** - New York Stock Exchange
- **NMS** - NASDAQ National Market System  
- **NYSE** - Alternative NYSE identifier
- **NYSEArca** - NYSE Arca
- **BATS** - Cboe BZX Exchange

### Example Output:

```json
{
  "metadata": {
    "exportDate": "2025-09-09T22:28:23.068Z",
    "exportType": "NYSE_only",
    "description": "Active tickers from New York Stock Exchange only",
    "exchanges": ["NYQ", "NYSE", "NMS", "NYSEArca", "BATS"]
  },
  "statistics": {
    "totalNYSETickers": 3842,
    "totalActiveAllExchanges": 16363,
    "nysePercentage": "23%",
    "priceStats": {
      "average": 69.21,
      "minimum": 0.05,
      "maximum": 8543
    }
  },
  "tickers": [...]
}
```

### CSV Format:

```csv
ticker,exchange,price,active
"AAPL","NMS",237.88,true
"MSFT","NMS",432.55,true
"GOOGL","NMS",166.89,true
```

## 🚀 Quick Start:

1. **Navigate to the export-advanced directory:**
   ```bash
   cd src/export-advanced
   ```

2. **Run NYSE export:**
   ```bash
   node export-nyse-results.js
   ```

3. **Check output:**
   ```bash
   ls -la ../../output/*nyse*
   ```

## 📊 Statistics:

- **3,842** NYSE tickers available
- **23%** of all active tickers are on major US exchanges
- Average price: **$69.21**
- Price range: **$0.05 - $8,543**

## 🔧 Customization:

To modify which exchanges are included, edit the `nyseExchanges` array in the script:

```javascript
this.nyseExchanges = [
    'NYQ',      // NYSE
    'NMS',      // NASDAQ
    // Add more exchanges here
];
```
