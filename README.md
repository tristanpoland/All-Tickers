# All-Tickers

A comprehensive database-driven ticker validation system using Yahoo Finance API and SQLite.

## 🚀 Quick Start

**New to this project?** → See **[SETUP.md](SETUP.md)** for complete setup instructions.

**Already set up?** → See **[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)** for detailed usage.

## 📦 One-Command Setup

```bash
# After cloning the repo:
npm install && npm run setup && npm run init
```

## 🔧 Quick Commands

```bash
npm run validate-active      # Validate active tickers
npm run validate-delisted    # Check delisted tickers  
npm run search              # Discover new tickers
npm run update-master       # Update master list
npm run export              # Export database to JSON
```

## 📁 Key Files

- **SETUP.md** - Complete setup guide for new installations
- **SYSTEM-OVERVIEW.md** - Detailed system documentation  
- **validate-active.js** - Main active ticker validation
- **validate-delisted.js** - Delisted ticker validation
- **Slow-Search.js** - Ticker discovery system
- **ticker-database.js** - Core database operations

## 🗃️ Database-Driven

All operations use SQLite database for:
- ✅ Data integrity and ACID compliance
- ✅ Progress tracking and auto-resume
- ✅ Automatic backups and recovery
- ✅ Efficient querying and updates

## 📊 Expected Output

After running validations, you'll get:

```
output/
├── tickers.db              # SQLite database (main storage)
├── active_tickers.json     # ["AAPL", "MSFT", "GOOGL", ...]
├── delisted_tickers.json   # ["EDMD", "XYZA", ...]
├── master-list.json        # [{"AAPL": true}, {"EDMD": false}, ...]
├── tickers_status.txt      # "AAPL:ACTIVE", "EDMD:DELISTED"
└── backups/                # Automatic backups during operations
```

## ⚡ Performance Notes

- **Progress is saved every 10 tickers** - safe to interrupt anytime
- **Rate limited** to respect Yahoo Finance API limits
- **Single-threaded by design** to avoid rate limiting issues
- **Can resume from interruptions** automatically
- **This takes time** - ticker validation is a marathon, not a sprint!

## 🔄 Migration from V2/V3

If you're upgrading from older versions:
1. Your old JSON files will be automatically imported to the database
2. All scripts now use the same database for consistency
3. V2 and V3 folders have been consolidated into the main directory

---

**Start here:** [SETUP.md](SETUP.md)
