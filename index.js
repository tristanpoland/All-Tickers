import fs from 'node:fs';
import yahooFinance from 'yahoo-finance2';
import path from 'node:path';

// Configuration
const OUTPUT_DIR = './output';
const ACTIVE_TICKERS_FILE = path.join(OUTPUT_DIR, 'active_tickers.json');
const DELISTED_TICKERS_FILE = path.join(OUTPUT_DIR, 'delisted_tickers.json');
const STATUS_FILE = path.join(OUTPUT_DIR, 'tickers_status.txt');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'checkpoint.json');
const ERROR_TICKERS_FILE = path.join(OUTPUT_DIR, 'error_tickers.json');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate ticker symbol from index
function generateTicker(index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // Calculate the ranges for each length
  const ranges = [26, 26*26, 26*26*26, 26*26*26*26];
  let remaining = index;
  for (let len = 1; len <= 4; len++) {
    const count = Math.pow(26, len);
    if (remaining < count) {
      // Generate ticker of length 'len'
      let result = '';
      for (let i = 0; i < len; i++) {
        result = letters[remaining % 26] + result;
        remaining = Math.floor(remaining / 26);
      }
      return result;
    }
    remaining -= count;
  }
  // If index is out of range, return empty string
  return '';
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
  let errorTickers = [];

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

  // Load error tickers if file exists
  if (fs.existsSync(ERROR_TICKERS_FILE)) {
    try {
      const data = fs.readFileSync(ERROR_TICKERS_FILE, 'utf8');
      errorTickers = JSON.parse(data);
      console.log(`⚠️ Loaded ${errorTickers.length} error tickers`);
    } catch (error) {
      console.error('❌ Error loading error tickers:', error.message);
    }
  }

  return { activeTickers, delistedTickers, errorTickers };
}

// Pause helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if ticker is active using Yahoo Finance API
async function checkTicker(ticker) {
  let validationError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
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
      if (error && error.message && error.message.includes('Expected union value')) {
        validationError = error;
        console.error(`❌ Validation error for symbol '${ticker}' (attempt ${attempt}): ${error.message}`);
        await sleep(500); // Wait before retrying
      } else {
        throw error; // Non-validation error, let main loop handle
      }
    }
  }
  // After 3 failed validation attempts, log to error_tickers.json
  if (validationError) {
    addErrorTicker(ticker, validationError.message);
  }
  return { isActive: false };
}

// Add ticker to error_tickers.json
function addErrorTicker(ticker, message) {
  let errorTickers = [];
  if (fs.existsSync(ERROR_TICKERS_FILE)) {
    try {
      errorTickers = JSON.parse(fs.readFileSync(ERROR_TICKERS_FILE, 'utf8'));
    } catch (e) {
      errorTickers = [];
    }
  }
  errorTickers.push({ ticker, message, timestamp: new Date().toISOString() });
  try {
    fs.writeFileSync(ERROR_TICKERS_FILE, JSON.stringify(errorTickers, null, 2));
    console.log(`⚠️ Added ${ticker} to error_tickers.json`);
  } catch (e) {
    console.error('❌ Error saving error_tickers.json:', e.message);
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
  const { activeTickers, delistedTickers, errorTickers } = loadExistingData();
  
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
    // Check if ticker already exists in our data
    const alreadyProcessed = activeTickers.includes(ticker) || delistedTickers.includes(ticker);
    if (alreadyProcessed) {
      console.log(`⏭️  Skipping ${ticker} (already processed)`);
      continue;
    }

    let result = null;
    let attempt = 0;
    const maxRetries = 3;
    let lastError = null;
    while (attempt < maxRetries) {
      try {
        result = await checkTicker(ticker);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        attempt++;
        console.error(`❌ Error checking ${ticker} (attempt ${attempt}): ${error.message}`);
        await sleep(500); // Wait before retrying
      }
    }

    if (!result) {
      consecutiveErrors++;
      console.error(`❌ Failed to process ${ticker} after ${maxRetries} attempts: ${lastError ? lastError.message : 'Unknown error'}`);
      // Log Yahoo schema validation errors to error_tickers.json
      if (lastError && lastError.message && (
        lastError.message.includes('Expected union value') ||
        lastError.message.includes('Failed Yahoo Schema validation')
      )) {
        addErrorTicker(ticker, lastError.message);
      }
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`🛑 Too many consecutive errors (${maxConsecutiveErrors}). Pausing for 60 seconds and retrying previous 10 tickers.`);
        saveData(activeTickers, delistedTickers);
        saveCheckpoint(i, totalTickers, processed, activeTickers, delistedTickers);
        await sleep(60000); // Pause for 60 seconds
        // Retry previous 10 tickers
        const retryStart = Math.max(i - 10, 0);
        for (let retryIdx = retryStart; retryIdx < i; retryIdx++) {
          const retryTicker = generateTicker(retryIdx);
          if (activeTickers.includes(retryTicker) || delistedTickers.includes(retryTicker)) continue;
          let retryResult = null;
          let retryAttempt = 0;
          let retryLastError = null;
          while (retryAttempt < maxRetries) {
            try {
              retryResult = await checkTicker(retryTicker);
              break;
            } catch (error) {
              retryAttempt++;
              retryLastError = error;
              console.error(`❌ Retry error for ${retryTicker} (attempt ${retryAttempt}): ${error.message}`);
              await sleep(500);
            }
          }
          if (!retryResult && retryLastError && retryLastError.message && (
            retryLastError.message.includes('Expected union value') ||
            retryLastError.message.includes('Failed Yahoo Schema validation')
          )) {
            addErrorTicker(retryTicker, retryLastError.message);
          }
          if (retryResult && retryResult.isActive) {
            activeTickers.push(retryTicker);
            updateStatus(retryIdx + 1, totalTickers, activeTickers, delistedTickers, retryTicker, true);
          } else if (retryResult) {
            delistedTickers.push(retryTicker);
            updateStatus(retryIdx + 1, totalTickers, activeTickers, delistedTickers, retryTicker, false);
          }
        }
        consecutiveErrors = 0;
        continue;
      }
      await sleep(0);
      
      continue;
    }

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
    await sleep(0);
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