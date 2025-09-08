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
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'checkpoint.json');

// Initialize database
const db = new TickerDatabase();

// Timing configuration for 15-minute breaks
let startTime = Date.now();
let lastPauseTime = Date.now();
const PAUSE_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const PAUSE_DURATION = 1 * 60 * 1000; // 1 minute in milliseconds

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate ticker symbol from index
function generateTicker(index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  // Calculate ranges for each length: A-Z (26), AA-ZZ (676), AAA-ZZZ (17576), AAAA-ZZZZ (456976)
  if (index < 26) {
    // 1-letter: A-Z
    return letters[index];
  } else if (index < 26 + 676) {
    // 2-letter: AA-ZZ
    const adjusted = index - 26;
    const first = Math.floor(adjusted / 26);
    const second = adjusted % 26;
    return letters[first] + letters[second];
  } else if (index < 26 + 676 + 17576) {
    // 3-letter: AAA-ZZZ
    const adjusted = index - 26 - 676;
    const first = Math.floor(adjusted / 676);
    const second = Math.floor((adjusted % 676) / 26);
    const third = adjusted % 26;
    return letters[first] + letters[second] + letters[third];
  } else if (index < 26 + 676 + 17576 + 456976) {
    // 4-letter: AAAA-ZZZZ
    const adjusted = index - 26 - 676 - 17576;
    const first = Math.floor(adjusted / 17576);
    const second = Math.floor((adjusted % 17576) / 676);
    const third = Math.floor((adjusted % 676) / 26);
    const fourth = adjusted % 26;
    return letters[first] + letters[second] + letters[third] + letters[fourth];
  }
  
  return ''; // Out of range
}

// Calculate total possible tickers (A through ZZZZ, optionally ZZZZZ)
function calculateTotalTickers(includeFineLetter = false) {
  // A-Z (26) + AA-ZZ (26*26) + AAA-ZZZ (26*26*26) + AAAA-ZZZZ (26*26*26*26)
  let total = 26 + (26 * 26) + (26 * 26 * 26) + (26 * 26 * 26 * 26);
  
  // Optionally add 5-letter tickers (AAAAA-ZZZZZ)
  if (includeFineLetter) {
    total += (26 * 26 * 26 * 26 * 26);
  }
  
  return total;
}

// Load checkpoint data
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      console.log(`📋 Checkpoint loaded - Resume from index: ${checkpoint.currentIndex}`);
      console.log(`📊 Progress: ${checkpoint.processed}/${checkpoint.total} tickers processed`);
      return checkpoint;
    }
  } catch (error) {
    console.error('❌ Error loading checkpoint:', error.message);
  }
  return null;
}

// Save checkpoint data
function saveCheckpoint(currentIndex, total, processed, activeCount, delistedCount) {
  const checkpoint = {
    currentIndex,
    total,
    processed,
    activeTickers: activeCount,
    delistedTickers: delistedCount,
    timestamp: new Date().toISOString(),
    lastProcessedTicker: currentIndex > 0 ? generateTicker(currentIndex - 1) : null
  };
  
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`💾 Checkpoint saved - Index: ${currentIndex}`);
  } catch (error) {
    console.error('❌ Error saving checkpoint:', error.message);
  }
}

// This function is no longer needed - database handles data persistence

// Pause helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if ticker is active using Yahoo Finance API (same logic as validation scripts)
async function checkTicker(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (quote?.symbol) {
      const exch = quote.fullExchangeName || quote.exchange || "";
      const isUS = exch.includes("NYSE") || exch.includes("Nasdaq") || exch.includes("AMEX");
      
      if (isUS && quote.regularMarketPrice != null) {
        return {
          isActive: true,
          symbol: quote.symbol,
          price: quote.regularMarketPrice,
          currency: quote.currency || 'USD',
          exchange: exch
        };
      } else if (isUS) {
        // US ticker but no price - delisted
        return {
          isActive: false,
          symbol: quote.symbol,
          price: null,
          currency: quote.currency || 'USD',
          exchange: exch
        };
      }
      // Non-US ticker - invalid
      return { isActive: false, exchange: exch };
    }
    
    return { isActive: false };
  } catch (error) {
    // Silently treat Yahoo Schema validation errors as delisted
    if (error && error.message && (
      error.message.includes('Expected union value') ||
      error.message.includes('Failed Yahoo Schema validation')
    )) {
      return { isActive: false };
    }
    // Yahoo Finance throws error for invalid/delisted tickers
    return { isActive: false };
  }
}

// This function is no longer needed - database handles data persistence

// Update status display
function updateStatus(currentIndex, total, activeCount, delistedCount, ticker, isActive) {
  const percentage = ((currentIndex / total) * 100).toFixed(2);
  const status = isActive ? '✅ ACTIVE' : '❌ DELISTED';
  
  console.log(`[${percentage}%] ${ticker} - ${status} | Active: ${activeCount} | Delisted: ${delistedCount}`);
}

// Main function
async function main() {
  console.log('🚀 Starting DATABASE ticker validation process...\n');
  
  try {
    // Initialize database
    await db.init();
    console.log('📊 Database initialized successfully');
    
    // Import from JSON files if database is empty and JSON files exist
    const stats = await db.getStats();
    if (stats.total === 0) {
      console.log('📥 Importing existing data from JSON files...');
      await db.importFromJSON();
    }
  
    // Load checkpoint and existing data
    const checkpoint = loadCheckpoint();
    const existingStats = await db.getStats();    // Calculate total and starting point
    const totalTickers = calculateTotalTickers();
    let startIndex = 0;
    let processed = existingStats.total;
  
    if (checkpoint) {
      startIndex = checkpoint.currentIndex;
      console.log(`📋 Checkpoint loaded - Resume from index: ${startIndex}`);
      console.log(`📊 Progress: ${checkpoint.processed}/${totalTickers} tickers processed`);
      console.log(`📈 Loaded ${existingStats.active} existing active tickers`);
      console.log(`📉 Loaded ${existingStats.delisted} existing delisted tickers`);
      console.log(`🔄 Resuming from ticker: ${generateTicker(startIndex)}`);
      console.log(`📊 Previous progress: ${checkpoint.processed}/${checkpoint.total} (${((checkpoint.processed/checkpoint.total)*100).toFixed(2)}%)\n`);
      
      // Check if we've actually processed all possible combinations
      // Use processed count vs total, not currentIndex vs total
      const actualProgress = checkpoint.processed / checkpoint.total;
    if (actualProgress >= 1.0 && startIndex >= totalTickers) {
      console.log('🎉 All ticker combinations A-ZZZZ have been processed!');
      console.log(`📈 Final results: ${activeTickers.length} active tickers`);
      console.log(`📉 Final results: ${delistedTickers.length} delisted tickers`);
      console.log('\n💡 Options:');
      console.log('   1. Delete checkpoint.json to restart from beginning');
      console.log('   2. Process completed - no more 4-letter tickers to check');
      console.log('   3. Modify script to include 5-letter tickers (AAAAA-ZZZZZ)');
      console.log('\n🔧 To restart: rm output/checkpoint.json && node Search.js');
      console.log('🔧 To extend to 5-letter: Edit calculateTotalTickers(true) in script');
      return;
    }
    
    // If currentIndex exceeds total but we haven't processed everything, reset the index
    if (startIndex >= totalTickers) {
      console.log('⚠️  Index exceeds total but processing incomplete. Continuing from unprocessed tickers...');
      startIndex = 0; // Start over but skip already processed tickers
    }
  } else {
    console.log('🆕 Starting fresh scan from ticker: A\n');
  }
  
  console.log(`📋 Total tickers to process: ${totalTickers.toLocaleString()}`);
  console.log(`📈 Currently have ${existingStats.active} active tickers`);
  console.log(`📉 Currently have ${existingStats.delisted} delisted tickers`);
  console.log(`🎯 Starting from index ${startIndex} (ticker: ${generateTicker(startIndex)})\n`);
  
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 10;
  
  for (let i = startIndex; i < totalTickers; i++) {
    const ticker = generateTicker(i);
    
    // Check if it's time for a 15-minute pause
    const currentTime = Date.now();
    if (currentTime - lastPauseTime >= PAUSE_INTERVAL) {
      const elapsedMinutes = Math.round((currentTime - startTime) / 1000 / 60);
      const currentStats = await db.getStats();
      
      console.log(`\n⏸️  Taking 1-minute break after ${elapsedMinutes} minutes of processing...`);
      console.log(`📊 Progress: ${processed}/${totalTickers} (${((processed/totalTickers)*100).toFixed(1)}%)`);
      console.log(`✅ Active: ${currentStats.active || 0} | ❌ Delisted: ${currentStats.delisted || 0}`);
      
      await sleep(PAUSE_DURATION);
      lastPauseTime = Date.now();
      
      console.log(`▶️  Resuming ticker validation...\n`);
    }
    
    try {
      // Check if ticker already exists in database
      const activeTickers = await db.getTickersByStatus('active');
      const delistedTickers = await db.getTickersByStatus('delisted');
      const alreadyProcessed = activeTickers.includes(ticker) || delistedTickers.includes(ticker);
      
      if (alreadyProcessed) {
        console.log(`⏭️  Skipping ${ticker} (already processed)`);
        // Don't increment processed count for skipped items
        continue;
      }
      
      const result = await checkTicker(ticker);
      
      if (result.isActive) {
        await db.upsertTicker(ticker, 'active', {
          price: result.price,
          exchange: result.exchange
        });
        console.log(`💾 ${ticker} → active (${result.exchange})`);
        const updatedStats = await db.getStats();
        updateStatus(i + 1, totalTickers, updatedStats.active, updatedStats.delisted, ticker, true);
      } else {
        await db.upsertTicker(ticker, 'delisted', {
          exchange: result.exchange || 'Unknown'
        });
        console.log(`💾 ${ticker} → delisted (${result.exchange || 'Unknown'})`);
        const updatedStats = await db.getStats();
        updateStatus(i + 1, totalTickers, updatedStats.active, updatedStats.delisted, ticker, false);
      }
      
      processed++;
      consecutiveErrors = 0;
      
      // Save progress every 10 tickers
      if (processed % 10 === 0) {
        await db.exportToJSON();
        const currentStats = await db.getStats();
        saveCheckpoint(i + 1, totalTickers, processed, currentStats.active, currentStats.delisted);
      }

      // Rate limiting - wait 1.5 seconds between requests
      await sleep(1500);
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ Error checking ${ticker}: ${error.message}`);
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`🛑 Too many consecutive errors (${maxConsecutiveErrors}). Stopping.`);
        // Save progress before stopping
        await db.exportToJSON();
        const currentStats = await db.getStats();
        saveCheckpoint(i, totalTickers, processed, currentStats.active, currentStats.delisted);
        break;
      }
      
      // Wait longer after errors
      await sleep(1000);
    }
  }
  
  // Final save
  await db.exportToJSON();
  const finalStats = await db.getStats();
  saveCheckpoint(totalTickers, totalTickers, processed, finalStats.active, finalStats.delisted);
  
  console.log('\n🎉 Ticker validation process completed!');
  console.log(`📈 Total active tickers found: ${finalStats.active}`);
  console.log(`📉 Total delisted tickers: ${finalStats.delisted}`);
  console.log(`📊 Total processed: ${processed}/${totalTickers}`);
  console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
  
  } catch (error) {
    console.error('❌ Database error during process:', error.message);
  } finally {
    await db.close();
    console.log('🗄️ Database connection closed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Process interrupted. Progress has been saved.');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Process terminated. Progress has been saved.');
  await db.close();
  process.exit(0);
});

// Start the process
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});