import fs from 'node:fs';
import yahooFinance from 'yahoo-finance2';
import path from 'node:path';

// Suppress yahoo-finance2 validation logging
yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false
  }
});

// Configuration
const OUTPUT_DIR = './output';
const DELISTED_TICKERS_FILE = path.join(OUTPUT_DIR, 'delisted_tickers.json');
const ACTIVE_TICKERS_FILE = path.join(OUTPUT_DIR, 'active_tickers.json');
const STATUS_FILE = path.join(OUTPUT_DIR, 'tickers_status.txt');
const BACKUP_SUFFIX = '.backup';
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'delisted_validation_progress.json');

// Create backup files before starting
function createBackups() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (fs.existsSync(ACTIVE_TICKERS_FILE)) {
    fs.copyFileSync(ACTIVE_TICKERS_FILE, `${ACTIVE_TICKERS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
    console.log(`📋 Backup created: ${ACTIVE_TICKERS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
  }
  
  if (fs.existsSync(DELISTED_TICKERS_FILE)) {
    fs.copyFileSync(DELISTED_TICKERS_FILE, `${DELISTED_TICKERS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
    console.log(`📋 Backup created: ${DELISTED_TICKERS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
  }
  
  if (fs.existsSync(STATUS_FILE)) {
    fs.copyFileSync(STATUS_FILE, `${STATUS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
    console.log(`📋 Backup created: ${STATUS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
  }
}

// Clean start - remove any existing progress file and start fresh
function initializeProgress() {
  // Remove existing progress file to start fresh
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log('🧹 Removed previous progress file - starting fresh');
  }
  
  return {
    processed: 0,
    processedTickers: [],
    nowActive: [],
    stillDelisted: [],
    startTime: new Date().toISOString()
  };
}

// Save progress
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Pause helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if ticker status has changed using Yahoo Finance API
async function validateTicker(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (quote?.symbol) {
      const exch = quote.fullExchangeName || quote.exchange || "";
      const isUS = exch.includes("NYSE") || exch.includes("Nasdaq") || exch.includes("AMEX");
      
      if (isUS && quote.regularMarketPrice != null) {
        return {
          status: "active",
          symbol: quote.symbol,
          price: quote.regularMarketPrice,
          exchange: exch
        };
      } else if (isUS) {
        return {
          status: "delisted",
          exchange: exch
        };
      } else {
        return {
          status: "invalid"
        };
      }
    }
    
    return { status: "delisted" }; // Assume still delisted if no data
  } catch (error) {
    // Silently treat Yahoo Schema validation errors as delisted
    if (error && error.message && (
      error.message.includes('Expected union value') ||
      error.message.includes('Failed Yahoo Schema validation')
    )) {
      return { status: "delisted" };
    }
    // Yahoo Finance throws error for invalid/delisted tickers
    return { status: "delisted" };
  }
}

// Main validation function
async function validateDelistedList() {
  console.log('🔍 Starting SAFE delisted ticker validation...\n');
  
  // Check if delisted tickers file exists
  if (!fs.existsSync(DELISTED_TICKERS_FILE)) {
    console.error('❌ delisted_tickers.json not found');
    console.log('💡 Run validation on active tickers first');
    return;
  }

  // Create backups
  createBackups();
  
  // Initialize fresh progress (removes any existing progress file)
  let progress = initializeProgress();

  // Load delisted tickers
  let delistedTickers;
  try {
    const data = fs.readFileSync(DELISTED_TICKERS_FILE, 'utf8');
    delistedTickers = JSON.parse(data);
    console.log(`📋 Loaded ${delistedTickers.length} delisted tickers to validate`);
  } catch (error) {
    console.error('❌ Error loading delisted tickers:', error.message);
    return;
  }

  // Load existing active tickers
  let existingActive = [];
  if (fs.existsSync(ACTIVE_TICKERS_FILE)) {
    try {
      const data = fs.readFileSync(ACTIVE_TICKERS_FILE, 'utf8');
      existingActive = JSON.parse(data);
      console.log(`📈 Loaded ${existingActive.length} existing active tickers`);
    } catch (error) {
      console.error('❌ Error loading active tickers:', error.message);
    }
  }

  const stillDelisted = [];
  const nowActive = [];
  const BATCH_SIZE = 10;
  
  // Process all tickers
  console.log(`📊 ${delistedTickers.length} tickers to process\n`);
  
  for (let i = 0; i < delistedTickers.length; i += BATCH_SIZE) {
    const batch = delistedTickers.slice(i, Math.min(i + BATCH_SIZE, delistedTickers.length));
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(delistedTickers.length / BATCH_SIZE);
    
    console.log(`� Processing batch ${batchNumber}/${totalBatches} (${batch.length} tickers)`);
    
    try {
      for (const ticker of batch) {
        console.log(`🔍 Checking ${ticker}...`);
        
        const result = await validateTicker(ticker);
        progress.processedTickers.push(ticker);
        
        if (result.status === "active") {
          progress.nowActive.push(ticker);
          console.log(`🎉 ${ticker} is now active again! $${result.price} (${result.exchange})`);
        } else {
          progress.stillDelisted.push(ticker);
          console.log(`⚰️ ${ticker} still delisted`);
        }
        
        progress.processed++;
        
        // Save progress after each ticker
        saveProgress(progress);
        
        await sleep(100); // Rate limiting
      }
      
      // Update files after each batch with proper cross-list movement
      console.log(`💾 Updating files after batch ${batchNumber}...`);
      
      try {
        // Calculate current state with cross-list movement
        const currentActive = [...new Set([...existingActive, ...progress.nowActive])].sort();
        const currentDelisted = progress.stillDelisted.sort();
        
        // Update files
        fs.writeFileSync(ACTIVE_TICKERS_FILE, JSON.stringify(currentActive, null, 2));
        fs.writeFileSync(DELISTED_TICKERS_FILE, JSON.stringify(currentDelisted, null, 2));
        
        // Update status file
        const statusEntries = [
          ...currentActive.map(ticker => `"${ticker}:ACTIVE"`),
          ...currentDelisted.map(ticker => `"${ticker}:DELISTED"`)
        ];
        fs.writeFileSync(STATUS_FILE, statusEntries.join(','));
        
        console.log(`✅ Files updated - Active: ${currentActive.length} (+${progress.nowActive.length} relisted), Delisted: ${currentDelisted.length}`);
        
        // Update existing active for next batch
        existingActive = currentActive;
        
      } catch (error) {
        console.error('❌ Error updating files:', error.message);
      }
      
      // Longer pause between batches
      await sleep(2000);
      
    } catch (error) {
      console.error(`❌ Batch ${batchNumber} error: ${error.message}`);
      // Don't mark as invalid - just skip and continue
      console.log(`⏭️ Skipping batch due to error`);
    }
    
    const overallProgress = (progress.processed / delistedTickers.length * 100).toFixed(2);
    console.log(`� Overall Progress: ${overallProgress}% completed (${progress.processed}/${delistedTickers.length})\n`);
  }
  
  // Final cleanup and summary
  console.log('\n🎉 Validation complete!');
  
  try {
    // Clean up progress file
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('🧹 Progress tracking file cleaned up');
    }
    
    // Show final summary
    console.log(`✅ Final results - Active: ${progress.nowActive.length} relisted, Delisted: ${progress.stillDelisted.length} still delisted`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.log('💡 Check backup files if needed');
  }
  
  console.log('\n✅ Safe validation completed!');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Validation interrupted by user.');
  console.log('💡 Progress has been saved. Original files are intact via backups.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Validation terminated. Original files are intact via backups.');
  process.exit(0);
});

// Start validation
validateDelistedList().catch(error => {
  console.error('💥 Fatal error during validation:', error);
  process.exit(1);
});
