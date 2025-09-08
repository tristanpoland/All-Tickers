# All-Tickers Setup Guide

This guide will help you set up the All-Tickers project on a new computer after cloning from Git.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (version 18 or higher)
  - Download from: https://nodejs.org/
  - Verify: `node --version`
- **npm** (comes with Node.js)
  - Verify: `npm --version`
- **Git** (for cloning the repository)
  - Verify: `git --version`

## 🚀 Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Micah-L18/All-Tickers.git
cd All-Tickers
```

### 2. Install Dependencies

The `node_modules/` folder is not included in the repository. Install all required packages:

```bash
npm install
```

This will install:
- **sqlite3** - SQLite database driver
- **sqlite** - Promise-based SQLite wrapper
- **yahoo-finance2** - Yahoo Finance API client

### 3. Create Output Directory

The `output/` folder is not included in Git. Create it:

```bash
mkdir output
```

### 4. Verify Installation

Test that everything is working:

```bash
# Check Node.js syntax on core files
node --check ticker-database.js
node --check validate-active.js
node --check validate-delisted.js
```

If no errors are shown, you're ready to go!

## 🗃️ Database Initialization

The project uses SQLite for data storage. On first run, the database will be automatically created.

### Option 1: Start Fresh (Recommended for new setup)

```bash
# Initialize with database-driven validation
node index-db.js
```

This will:
- Create the SQLite database (`output/tickers.db`)
- Set up the required tables and indexes
- Ready the system for ticker validation

### Option 2: Import Existing JSON Data (If you have previous data)

If you have existing `active_tickers.json` and `delisted_tickers.json` files:

1. Place them in the `output/` folder
2. Run any validation script - it will automatically import the JSON data into the database

## 📁 Project Structure After Setup

```
All-Tickers/
├── 📄 Core Scripts
│   ├── ticker-database.js          # SQLite database operations
│   ├── validate-active.js          # Validate active tickers
│   ├── validate-delisted.js        # Validate delisted tickers
│   └── Slow-Search.js              # Discover new tickers
├── ⚙️ Utility Scripts
│   ├── index-db.js                 # Main database workflow
│   ├── export-to-json.js           # Export database to JSON
│   ├── update-master-list.js       # Update master list
│   └── Manual-Validate.js          # Manual ticker validation
├── 📦 Project Files
│   ├── package.json                # Dependencies and config
│   ├── package-lock.json           # Dependency lock file
│   └── .gitignore                  # Git ignore rules
├── 📂 Data Directories
│   ├── node_modules/               # Installed packages
│   └── output/                     # Database and export files
└── 📚 Documentation
    ├── SYSTEM-OVERVIEW.md          # System documentation
    └── SETUP.md                    # This setup guide
```

## 🔧 Available Commands

### Main Validation Scripts
```bash
# Validate active tickers (check if they're still trading)
node validate-active.js

# Validate delisted tickers (check if any have relisted)
node validate-delisted.js

# Discover new tickers by systematic search
node Slow-Search.js
```

### Utility Commands
```bash
# Full database workflow (init + import + validate)
node index-db.js

# Export database contents to JSON files
node export-to-json.js

# Update master-list.json from database
node update-master-list.js

# Manual validation of specific tickers
node Manual-Validate.js
```

## 📊 Output Files

After running validation scripts, the following files will be created in `output/`:

- **`tickers.db`** - SQLite database (main data storage)
- **`active_tickers.json`** - List of active ticker symbols
- **`delisted_tickers.json`** - List of delisted ticker symbols
- **`master-list.json`** - Combined list in format `[{"TICKER": true/false}]`
- **`tickers_status.txt`** - Human-readable status summary
- **`backups/`** - Automatic backups during validation

## 🛠️ Troubleshooting

### Common Issues

**1. `MODULE_NOT_FOUND` Error**
```bash
# Solution: Install dependencies
npm install
```

**2. `ENOENT: no such file or directory, open './output/...`**
```bash
# Solution: Create output directory
mkdir output
```

**3. SQLite Installation Issues (Windows)**
```bash
# May need to install build tools
npm install --global windows-build-tools
# Then retry
npm install
```

**4. Permission Issues (macOS/Linux)**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Database Issues

**Reset Database (Fresh Start)**
```bash
# Remove existing database
rm output/tickers.db
# Run any script to recreate
node index-db.js
```

**Check Database Contents**
```bash
# Export current data to see what's in database
node export-to-json.js
```

## 🔄 Regular Workflow

Once set up, your typical workflow will be:

1. **Daily/Weekly Validation**:
   ```bash
   node validate-active.js
   ```

2. **Monthly Deep Check**:
   ```bash
   node validate-delisted.js
   ```

3. **Update Master List** (after validations):
   ```bash
   node update-master-list.js
   ```

4. **Discovery Mode** (occasional):
   ```bash
   node Slow-Search.js
   ```

## 📈 System Features

- ✅ **Database-Driven**: All operations use SQLite for data integrity
- ✅ **Auto-Resume**: Scripts can resume from interruptions
- ✅ **Progress Tracking**: Real-time progress display and logging
- ✅ **Automatic Backups**: Original data preserved during operations
- ✅ **JSON Compatibility**: Exports to JSON for external use
- ✅ **Rate Limited**: Respects Yahoo Finance API limits
- ✅ **Error Handling**: Graceful handling of network/API issues

## 💡 Tips

- **Run scripts in separate terminal sessions** for concurrent operations
- **Check output folder regularly** for backups and progress files  
- **Use Ctrl+C to safely interrupt** any running validation
- **Database exports are atomic** - safe to interrupt and resume
- **All validations create backups** before making changes

## 📞 Support

If you encounter issues:

1. Check the `output/` folder exists and is writable
2. Verify all dependencies are installed (`npm list`)
3. Test with a simple command like `node export-to-json.js`
4. Check the system overview: `SYSTEM-OVERVIEW.md`

---

**Ready to start validating tickers!** 🎯
