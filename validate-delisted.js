import fs from 'fs';
import path from 'path';
import TickerDatabase from './ticker-database.js';
import yahooFinance from 'yahoo-finance2';

// Configure yahoo-finance2 to reduce logging
yahooFinance.setGlobalConfig({
  notifyRatelimit: false,
  queue: {
    timeout: 60000,
    concurrency: 1
  }
});

// File paths
const ACTIVE_TICKERS_FILE = './output/active_tickers.json';
const DELISTED_TICKERS_FILE = './output/delisted_tickers.json';
const STATUS_FILE = './output/tickers_status.txt';
const PROGRESS_FILE = './output/delisted_validation_progress.json';
const BACKUP_DIR = './output/backups';

// Helper function to create backups
function createBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  if (fs.existsSync(ACTIVE_TICKERS_FILE)) {
    fs.copyFileSync(ACTIVE_TICKERS_FILE, path.join(BACKUP_DIR, `active_tickers_${timestamp}.json`));
    console.log(`💾 Backup created: active_tickers_${timestamp}.json`);
  }
  
  if (fs.existsSync(DELISTED_TICKERS_FILE)) {
    fs.copyFileSync(DELISTED_TICKERS_FILE, path.join(BACKUP_DIR, `delisted_tickers_${timestamp}.json`));
    console.log(`💾 Backup created: delisted_tickers_${timestamp}.json`);
  }
  
  if (fs.existsSync(STATUS_FILE)) {
    fs.copyFileSync(STATUS_FILE, path.join(BACKUP_DIR, `tickers_status_${timestamp}.txt`));
    console.log(`💾 Backup created: tickers_status_${timestamp}.txt`);
  }
}

// Progress tracking functions
function initializeProgress() {
  const progress = {
    processed: 0,
    backToActive: [],
    stillDelisted: [],
    processedTickers: []
  };
  
  // Remove any existing progress file to start fresh
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
  
  return progress;
}

function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('❌ Error saving progress:', error.message);
  }
}

// Utility function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Yahoo Finance validation function with proper error handling
async function validateTicker(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (!quote || !quote.regularMarketPrice) {
      return { status: "delisted", ticker, price: null, exchange: null };
    }
    
    const price = quote.regularMarketPrice;
    const exchange = quote.exchange || 'UNKNOWN';
    
    // If we got a price, the ticker is actually active again!
    return { status: "active", ticker, price, exchange };
    
  } catch (error) {
    // Silently handle FailedYahooValidationError - these are confirmed delisted tickers
    if (error.name === 'FailedYahooValidationError') {
      return { status: "delisted", ticker, exchange: error.exchange || 'UNKNOWN' };
    }
    
    // For other errors, assume still delisted
    return { status: "delisted", ticker, exchange: 'ERROR' };
  }
}

// Main validation function
async function validateDelistedList() {
  console.log('🔍 Starting DATABASE delisted ticker validation...\n');
  console.log('💡 This checks if any delisted tickers have become active again.\n');
  
  const db = new TickerDatabase();
  
  try {
    // Initialize database
    await db.init();
    
    // Import from JSON files if database is empty and JSON files exist
    const stats = await db.getStats();
    if (stats.total === 0 && fs.existsSync(DELISTED_TICKERS_FILE)) {
      console.log('📥 Importing existing JSON data...');
      await db.importFromJSON();
    }
    
    // Get delisted tickers from database
    const delistedTickers = await db.getTickersByStatus('delisted');
    
    if (delistedTickers.length === 0) {
      console.log('✅ No delisted tickers found in database to validate');
      return;
    }
    
    console.log(`📋 Loaded ${delistedTickers.length} delisted tickers to validate\n`);
    
    // Create backups of JSON files (for safety)
    createBackups();
    
    // Initialize progress tracking
    let progress = initializeProgress();
    
    const BATCH_SIZE = 10;
    
    // Process all tickers
    for (let i = 0; i < delistedTickers.length; i += BATCH_SIZE) {
      const batch = delistedTickers.slice(i, Math.min(i + BATCH_SIZE, delistedTickers.length));
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(delistedTickers.length / BATCH_SIZE);
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tickers)`);
      
      try {
        for (const ticker of batch) {
          console.log(`🔍 Checking ${ticker}...`);
          
          const result = await validateTicker(ticker);
          progress.processedTickers.push(ticker);
          
          if (result.status === "active") {
            progress.backToActive.push(ticker);
            // Move back to active in database
            await db.upsertTicker(ticker, 'active', {
              price: result.price,
              exchange: result.exchange
            });
            console.log(`🎉 ${ticker} BACK TO ACTIVE! - $${result.price} (${result.exchange})`);
          } else {
            progress.stillDelisted.push(ticker);
            // Keep as delisted in database (update exchange if available)
            await db.upsertTicker(ticker, 'delisted', {
              exchange: result.exchange
            });
            console.log(`⚰️ ${ticker} still delisted (${result.exchange})`);
          }
          
          progress.processed++;
          
          // Save progress after each ticker
          saveProgress(progress);
          
          await sleep(100); // Rate limiting
        }
        
        // Export to JSON after each batch
        console.log(`💾 Updating JSON files after batch ${batchNumber}...`);
        const exported = await db.exportToJSON();
        console.log(`✅ JSON files updated - Active: ${exported.active}, Delisted: ${exported.delisted}`);
        
        // Longer pause between batches
        await sleep(2000);
        
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} error: ${error.message}`);
        console.log(`⏭️ Skipping batch due to error`);
      }
      
      const overallProgress = (progress.processed / delistedTickers.length * 100).toFixed(2);
      console.log(`📊 Overall Progress: ${overallProgress}% completed (${progress.processed}/${delistedTickers.length})\n`);
    }
    
    // Final cleanup and summary
    console.log('\n🎉 Delisted validation complete!');
    
    // Final export
    const finalStats = await db.getStats();
    await db.exportToJSON();
    
    if (progress.backToActive.length > 0) {
      console.log(`🎉 Great news! ${progress.backToActive.length} ticker(s) are ACTIVE AGAIN:`);
      progress.backToActive.forEach(ticker => console.log(`   📈 ${ticker}`));
    } else {
      console.log('📊 No delisted tickers have returned to active status');
    }
    
    console.log(`✅ Final results - Active: ${finalStats.active}, Delisted: ${finalStats.delisted}`);
    
  } catch (error) {
    console.error('❌ Database validation failed:', error.message);
  } finally {
    await db.close();
    
    // Clean up progress file
    try {
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('🧹 Progress tracking file cleaned up');
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
    }
  }
  
  console.log('\n✅ Database delisted validation completed!');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Validation interrupted by user.');
  console.log('💡 Progress has been saved. Database state is consistent.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Validation terminated. Database state is consistent.');
  process.exit(0);
});

// Start validation
validateDelistedList().catch(error => {
  console.error('💥 Fatal error during validation:', error);
  process.exit(1);
});
