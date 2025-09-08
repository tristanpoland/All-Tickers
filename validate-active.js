import fs from 'node:fs';
import yahooFinance from 'yahoo-finance2';
import path from 'node:path';
import TickerDatabase from './ticker-database.js';

// Suppress yahoo-finance2 validation logging
yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false
  }
});

// Configuration
const OUTPUT_DIR = './output';
const ACTIVE_TICKERS_FILE = path.join(OUTPUT_DIR, 'active_tickers.json');
const DELISTED_TICKERS_FILE = path.join(OUTPUT_DIR, 'delisted_tickers.json');
const STATUS_FILE = path.join(OUTPUT_DIR, 'tickers_status.txt');
const BACKUP_SUFFIX = '.backup';
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'validation_progress.json');

// Create backup files before starting
function createBackups() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (fs.existsSync(ACTIVE_TICKERS_FILE)) {
    fs.copyFileSync(ACTIVE_TICKERS_FILE, `${ACTIVE_TICKERS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
    console.log(`💾 Active tickers backup created`);
  }
  
  if (fs.existsSync(DELISTED_TICKERS_FILE)) {
    fs.copyFileSync(DELISTED_TICKERS_FILE, `${DELISTED_TICKERS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
    console.log(`💾 Delisted tickers backup created`);
  }
  
  if (fs.existsSync(STATUS_FILE)) {
    fs.copyFileSync(STATUS_FILE, `${STATUS_FILE}${BACKUP_SUFFIX}-${timestamp}`);
    console.log(`💾 Status file backup created`);
  }
}

// Initialize progress tracking
function initializeProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📊 Resuming from progress: ${data.processed} tickers processed`);
      return data;
    } catch (error) {
      console.log(`❌ Progress file corrupted, starting fresh`);
    }
  }
  
  return {
    processed: 0,
    processedTickers: [],
    stillActive: [],
    nowDelisted: []
  };
}

// Save progress periodically
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Sleep function for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if ticker is still active using Yahoo Finance API
async function validateTicker(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (quote?.symbol) {
      const exch = quote.fullExchangeName || quote.exchange || "";
      const isUS = exch.includes("NYSE") || exch.includes("Nasdaq") || exch.includes("AMEX");
      
      if (isUS) {
        return { status: "active", exchange: exch, price: quote.regularMarketPrice };
      }
    }
    
    return { status: "invalid" };
  } catch (error) {
    // Silently treat Yahoo Schema validation errors as delisted
    if (error && error.message && (
      error.message.includes('Expected union value') ||
      error.message.includes('Failed Yahoo Schema validation')
    )) {
      return { status: "delisted" };
    }
    // Yahoo Finance throws error for invalid/delisted tickers
    return { status: "invalid" };
  }
}

// Main validation function
async function validateActiveList() {
  console.log('🔍 Starting DATABASE active ticker validation...\n');
  
  const db = new TickerDatabase();
  
  try {
    // Initialize database
    await db.init();
    
    // Import from JSON files if database is empty and JSON files exist
    const stats = await db.getStats();
    if (stats.total === 0) {
      console.log('📊 Database is empty, importing from JSON files...');
      await db.importFromJSON();
      console.log('✅ Import completed\n');
    }
    
    // Get active tickers from database
    const activeTickers = await db.getTickersByStatus('active');
    console.log(`📈 Found ${activeTickers.length} active tickers to validate\n`);
    
    if (activeTickers.length === 0) {
      console.log('❌ No active tickers found in database.');
      return;
    }
    
    // Create backups before starting
    createBackups();
    
    // Initialize progress tracking
    const progress = initializeProgress();
    
    // Load existing delisted list to prevent duplicates
    let existingDelisted = await db.getTickersByStatus('delisted');
    
    // Process tickers in batches to avoid overwhelming the API
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < activeTickers.length; i += BATCH_SIZE) {
      const batch = activeTickers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(activeTickers.length / BATCH_SIZE);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tickers)`);
      
      try {
        for (const tickerObj of batch) {
          const ticker = typeof tickerObj === 'string' ? tickerObj : tickerObj.symbol;
          console.log(`🔍 Validating ${ticker}...`);
          
          const result = await validateTicker(ticker);
          progress.processedTickers.push(ticker);
          
          if (result.status === "active") {
            progress.stillActive.push(ticker);
            console.log(`✅ ${ticker} - Still active (${result.exchange})`);
            
            // Update ticker details in database
            await db.upsertTicker(ticker, 'active', {
              price: result.price,
              exchange: result.exchange
            });
            
          } else {
            progress.nowDelisted.push(ticker);
            console.log(`❌ ${ticker} - Now delisted/invalid`);
            
            // Move ticker to delisted status
            await db.moveTickerToStatus(ticker, 'delisted');
          }
          
          progress.processed++;
          
          // Rate limiting pause
          await sleep(500);
        }
        
        // Save progress after each batch
        saveProgress(progress);
        console.log(`💾 Progress saved: ${progress.processed}/${activeTickers.length} processed\n`);
        
        // Longer pause between batches
        await sleep(2000);
        
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} error: ${error.message}`);
        console.log(`⏭️ Skipping batch due to error`);
      }
      
      const overallProgress = (progress.processed / activeTickers.length * 100).toFixed(2);
      console.log(`📊 Overall Progress: ${overallProgress}% completed (${progress.processed}/${activeTickers.length})\n`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error during validation:', error.message);
    throw error;
  } finally {
    // Always close the database connection
    await db.close();
  }
  
  // Final cleanup and summary
  console.log('\n🎉 Validation complete!');
  
  try {
    // Clean up progress file
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('🧹 Progress tracking file cleaned up');
    }
    
    // Export updated data to JSON files
    await db.exportToJSON();
    console.log('📁 Updated JSON files exported');
    
  } catch (error) {
    console.error('❌ Error in final cleanup:', error.message);
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
validateActiveList().catch(error => {
  console.error('💥 Fatal error during validation:', error);
  process.exit(1);
});
