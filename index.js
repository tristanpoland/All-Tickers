import fs from 'node:fs';
import yahooFinance from 'yahoo-finance2';
import path from 'node:path';

// Configuration
const OUTPUT_DIR = './output';
const ACTIVE_TICKERS_FILE = path.join(OUTPUT_DIR, 'active_tickers.json');
const DELISTED_TICKERS_FILE = path.join(OUTPUT_DIR, 'delisted_tickers.json');
const STATUS_FILE = path.join(OUTPUT_DIR, 'tickers_status.txt');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'checkpoint.json');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate ticker symbol from index
function generateTicker(index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  let num = index;
  
  do {
    result = letters[num % 26] + result;
    num = Math.floor(num / 26);
  } while (num > 0);
  
  return result;
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
function saveCheckpoint(currentIndex, total, processed, activeTickers, delistedTickers) {
  const checkpoint = {
    currentIndex,
    total,
    processed,
    activeTickers: activeTickers.length,
    delistedTickers: delistedTickers.length,
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

// Load existing data files
function loadExistingData() {
  let activeTickers = [];
  let delistedTickers = [];
  
  // Load active tickers if file exists
  if (fs.existsSync(ACTIVE_TICKERS_FILE)) {
    try {
      const data = fs.readFileSync(ACTIVE_TICKERS_FILE, 'utf8');
      activeTickers = JSON.parse(data);
      console.log(`📈 Loaded ${activeTickers.length} existing active tickers`);
    } catch (error) {
      console.error('❌ Error loading active tickers:', error.message);
    }
  }
  
  // Load delisted tickers if file exists
  if (fs.existsSync(DELISTED_TICKERS_FILE)) {
    try {
      const data = fs.readFileSync(DELISTED_TICKERS_FILE, 'utf8');
      delistedTickers = JSON.parse(data);
      console.log(`📉 Loaded ${delistedTickers.length} existing delisted tickers`);
    } catch (error) {
      console.error('❌ Error loading delisted tickers:', error.message);
    }
  }
  
  return { activeTickers, delistedTickers };
}

// Pause helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if ticker is active using Yahoo Finance API
async function checkTicker(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (quote?.symbol) {
      return {
        isActive: true,
        symbol: quote.symbol,
        price: quote.regularMarketPrice || 0,
        currency: quote.currency || 'USD',
        exchange: quote.fullExchangeName || 'Unknown'
      };
    }
    
    return { isActive: false };
  } catch (error) {
    // Yahoo Finance throws error for invalid/delisted tickers
    return { isActive: false };
  }
}

// Save data to files
function saveData(activeTickers, delistedTickers) {
  try {
    fs.writeFileSync(ACTIVE_TICKERS_FILE, JSON.stringify(activeTickers, null, 2));
    fs.writeFileSync(DELISTED_TICKERS_FILE, JSON.stringify(delistedTickers, null, 2));
    
    // Update status file in the requested format
    const statusEntries = [
      ...activeTickers.map(ticker => `"${ticker}:ACTIVE"`),
      ...delistedTickers.map(ticker => `"${ticker}:DELISTED"`)
    ];
    fs.writeFileSync(STATUS_FILE, statusEntries.join(','));
    
    console.log(`� Data saved - Active: ${activeTickers.length}, Delisted: ${delistedTickers.length}`);
  } catch (error) {
    console.error('❌ Error saving data:', error.message);
  }
}

// Update status display
function updateStatus(currentIndex, total, activeTickers, delistedTickers, ticker, isActive) {
  const percentage = ((currentIndex / total) * 100).toFixed(2);
  const status = isActive ? '✅ ACTIVE' : '❌ DELISTED';
  
  console.log(`[${percentage}%] ${ticker} - ${status} | Active: ${activeTickers.length} | Delisted: ${delistedTickers.length}`);
}

// Main function
async function main() {
  console.log('🚀 Starting ticker validation process...\n');
  
  // Load checkpoint and existing data
  const checkpoint = loadCheckpoint();
  const { activeTickers, delistedTickers } = loadExistingData();
  
  // Calculate total and starting point
  const totalTickers = calculateTotalTickers();
  let startIndex = 0;
  let processed = activeTickers.length + delistedTickers.length;
  
  if (checkpoint) {
    startIndex = checkpoint.currentIndex;
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
      console.log('\n🔧 To restart: rm output/checkpoint.json && node index.js');
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
  console.log(`📈 Currently have ${activeTickers.length} active tickers`);
  console.log(`📉 Currently have ${delistedTickers.length} delisted tickers`);
  console.log(`🎯 Starting from index ${startIndex} (ticker: ${generateTicker(startIndex)})\n`);
  
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 10;
  
  for (let i = startIndex; i < totalTickers; i++) {
    const ticker = generateTicker(i);
    
    try {
      // Check if ticker already exists in our data
      const alreadyProcessed = activeTickers.includes(ticker) || delistedTickers.includes(ticker);
      
      if (alreadyProcessed) {
        console.log(`⏭️  Skipping ${ticker} (already processed)`);
        // Don't increment processed count for skipped items
        continue;
      }
      
      const result = await checkTicker(ticker);
      
      if (result.isActive) {
        activeTickers.push(ticker);
        updateStatus(i + 1, totalTickers, activeTickers, delistedTickers, ticker, true);
      } else {
        delistedTickers.push(ticker);
        updateStatus(i + 1, totalTickers, activeTickers, delistedTickers, ticker, false);
      }
      
      processed++;
      consecutiveErrors = 0;
      
      // Save progress every 10 tickers
      if (processed % 10 === 0) {
        saveData(activeTickers, delistedTickers);
        saveCheckpoint(i + 1, totalTickers, processed, activeTickers, delistedTickers);
      }
      
      // Rate limiting - wait 100ms between requests
      await sleep(100);
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ Error checking ${ticker}: ${error.message}`);
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`🛑 Too many consecutive errors (${maxConsecutiveErrors}). Stopping.`);
        // Save progress before stopping
        saveData(activeTickers, delistedTickers);
        saveCheckpoint(i, totalTickers, processed, activeTickers, delistedTickers);
        break;
      }
      
      // Wait longer after errors
      await sleep(1000);
    }
  }
  
  // Final save
  saveData(activeTickers, delistedTickers);
  saveCheckpoint(totalTickers, totalTickers, processed, activeTickers, delistedTickers);
  
  console.log('\n🎉 Ticker validation process completed!');
  console.log(`📈 Total active tickers found: ${activeTickers.length}`);
  console.log(`📉 Total delisted tickers: ${delistedTickers.length}`);
  console.log(`📊 Total processed: ${processed}/${totalTickers}`);
  console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted. Progress has been saved.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Process terminated. Progress has been saved.');
  process.exit(0);
});

// Start the process
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});