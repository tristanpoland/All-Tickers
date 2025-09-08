# 🚀 Bulk Script Quick Start

The `bulk.sh` script automates the entire ticker discovery process from start to finish!

## ⚡ Super Quick Start

```bash
# Most common usage - get 66% of all US tickers in ~8 hours
./bulk.sh

# That's it! The script will:
# 1. Generate all 1-3 letter ticker combinations (~18K tickers)
# 2. Test validate the first 100 to make sure everything works
# 3. Validate all remaining tickers (finding ~2,650 active ones)
# 4. Export results to Google Sheets (if configured)
```

## 🎯 Common Usage Patterns

### Testing & Development
```bash
./bulk.sh -l 2 -d                    # Dry run with 2-letter tickers (preview)
./bulk.sh -l 2 -t 50                 # Small test: 2-letter tickers, test 50
./bulk.sh -l 3 -t 500                # Medium test: 3-letter tickers, test 500
```

### Production Runs
```bash
./bulk.sh                            # Default: 3-letter tickers (~8 hours)
./bulk.sh -l 4 -y                    # Full coverage: 4-letter tickers (~200 hours)
./bulk.sh -l 3 -s                    # Quick run without Google Sheets
```

### Resume/Partial Runs
```bash
./bulk.sh -g                         # Skip generation, just validate existing
./bulk.sh -v                         # Generate only, skip validation
./bulk.sh -g -t 1000                 # Skip generation, test 1000 validations
```

## 📊 What Each Option Does

| Option | Description | Example |
|--------|-------------|---------|
| `-l 2` | Only 1-2 letter tickers | `AA`, `ZZ` (702 total) |
| `-l 3` | Up to 3-letter tickers | `AAA`, `ZZZ` (18,278 total) ⭐ **Recommended** |
| `-l 4` | Up to 4-letter tickers | `AAAA`, `ZZZZ` (475,254 total) |
| `-t 100` | Test first 100 tickers | Safety check before full run |
| `-d` | Dry run | Preview without making changes |
| `-g` | Skip generation | Use existing database |
| `-v` | Skip validation | Generate only |
| `-s` | No Google Sheets | Skip export step |
| `-y` | Auto-confirm | No prompts (for scripts) |

## ⏱️ Time Estimates

| Max Length | Total Tickers | Estimated Time | Coverage |
|------------|---------------|----------------|----------|
| 2 letters | 702 | ~18 minutes | ~5% of US market |
| **3 letters** | **18,278** | **~7.6 hours** | **~66% of US market** ⭐ |
| 4 letters | 475,254 | ~198 hours (8.3 days) | ~100% of US market |
| 5 letters | 12,356,630 | ~5,148 hours (214 days) | Overkill |

## 🎉 Success Output

When successful, you'll see:
```
✅ Ticker generation completed
✅ Test validation completed  
✅ Full validation completed
✅ Google Sheets export completed
🎉 Bulk process completed successfully!

📊 Final Results:
   Total tickers processed: 18,278
   Active tickers found: 2,654
   Delisted tickers: 15,624
   Success rate: 14.52%
```

## 🛑 Interruption & Resume

The script can be safely interrupted (Ctrl+C) at any time:
- **Generation phase**: Can restart from beginning (fast)
- **Validation phase**: Progress saved every 10 tickers, can resume exactly where left off
- **Export phase**: Can re-run export anytime

To resume validation after interruption:
```bash
./bulk.sh -g    # Skip generation, resume validation
```

## 🚨 Troubleshooting

### "Command not found"
```bash
chmod +x bulk.sh    # Make script executable
```

### "bc: command not found" 
```bash
# On macOS (usually included):
which bc

# If missing, calculations will show "N/A" but script still works
```

### "Prerequisites check failed"
```bash
npm install         # Install Node.js dependencies first
```

### Google Sheets not working
```bash
./bulk.sh -s        # Skip Google Sheets export
# Or see GOOGLE-SHEETS.md for setup instructions
```

## 💡 Pro Tips

1. **Start with 3-letters**: Perfect balance of coverage vs time
2. **Always test first**: Use `-t 100` to verify before full runs  
3. **Run overnight**: 7.6 hours fits perfectly in an overnight run
4. **Use dry-run**: Always preview large runs with `-d` first
5. **Monitor progress**: The script shows live progress and ETAs
6. **Safe interruption**: Ctrl+C anytime, progress is saved
7. **Multiple runs**: Can run script multiple times safely

## 🎯 Recommended Workflow

```bash
# Step 1: Preview what will happen
./bulk.sh -d

# Step 2: Test run with small batch  
./bulk.sh -l 3 -t 100

# Step 3: If test looks good, run full process
./bulk.sh -l 3

# Step 4: Check results in output/ folder and Google Sheets
```

**That's it! The bulk script handles everything automatically.** 🚀
