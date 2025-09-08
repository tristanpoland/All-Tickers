import fs from 'fs';
import yahooFinance from 'yahoo-finance2';
import TickerDatabase from './ticker-database.js';

// Configure yahoo-finance2 to reduce logging
yahooFinance.setGlobalConfig({
  notifyRatelimit: false,
  queue: {
    timeout: 60000,
    concurrency: 1
  }
});

// Constants
const CHECKPOINT_FILE = './output/checkpoint.json';
const LOG_FILE = 'log.txt';

// Initialize database
const db = new TickerDatabase();

// Utility function to sleep for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to generate all ticker combinations
function generateTickers() {
  const tickers = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  // Single letters (A-Z)
  for (let i = 0; i < letters.length; i++) {
    tickers.push(letters[i]);
  }
  
  // Two letters (AA-ZZ)
  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      tickers.push(letters[i] + letters[j]);
    }
  }
  
  // Three letters (AAA-ZZZ)
  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      for (let k = 0; k < letters.length; k++) {
        tickers.push(letters[i] + letters[j] + letters[k]);
      }
    }
  }
  
  // Four letters (AAAA-ZZZZ)
  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      for (let k = 0; k < letters.length; k++) {
        for (let l = 0; l < letters.length; l++) {
          tickers.push(letters[i] + letters[j] + letters[k] + letters[l]);
        }
      }
    }
  }
  
  console.log(`📋 Generated ${tickers.length} ticker combinations`);
  return tickers;
}

// Function to validate a ticker
async function validateTicker(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (!quote || !quote.regularMarketPrice) {
      return { status: "delisted", ticker, price: null, exchange: null };
    }
    
    const price = quote.regularMarketPrice;
    const exchange = quote.exchange || 'UNKNOWN';
    
    return { status: "active", ticker, price, exchange };
    
  } catch (error) {
    if (error.name === 'FailedYahooValidationError') {
      return { status: "delisted", ticker, exchange: error.exchange || 'UNKNOWN' };
    }
    
    return { status: "delisted", ticker, exchange: 'ERROR' };
  }
}

// Function to save checkpoint
function saveCheckpoint(checkpoint) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  } catch (error) {
    console.error('❌ Error saving checkpoint:', error.message);
  }
}

// Function to load checkpoint
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('❌ Error loading checkpoint:', error.message);
  }
  return null;
}

// Function to log ticker status
function logTicker(ticker, status, exchange, price = null) {
  const timestamp = new Date().toISOString();
  const logEntry = price 
    ? `[${timestamp}] ${ticker}: ${status} (${exchange}) - $${price}\n`
    : `[${timestamp}] ${ticker}: ${status} (${exchange})\n`;
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    console.error('❌ Error writing to log:', error.message);
  }
}

// Main discovery function
async function discoverAllTickers() {
  console.log('🔍 Starting DATABASE ticker discovery...\n');
  
  try {
    // Initialize database
    await db.init();
    console.log('📊 Database initialized successfully\n');
    
    const allTickers = generateTickers();
    const checkpoint = loadCheckpoint() || {
      currentIndex: 0,
      total: allTickers.length,
      processed: 0,
      activeTickers: 0,
      delistedTickers: 0,
      timestamp: new Date().toISOString(),
      lastProcessedTicker: null
    };
    
    console.log(`📋 Total tickers to process: ${allTickers.length}`);
    console.log(`🔄 Resuming from index ${checkpoint.currentIndex} (${checkpoint.processed} processed)`);
    console.log(`📊 Current stats - Active: ${checkpoint.activeTickers}, Delisted: ${checkpoint.delistedTickers}\n`);
    
    const BATCH_SIZE = 10;
    const SAVE_EVERY = 10; // Save to database every 10 tickers
    
    for (let i = checkpoint.currentIndex; i < allTickers.length; i++) {
      const ticker = allTickers[i];
      console.log(`🔍 [${i + 1}/${allTickers.length}] Checking ${ticker}...`);
      
      try {
        const result = await validateTicker(ticker);
        
        if (result.status === "active") {
          await db.upsertTicker(ticker, 'active', {
            price: result.price,
            exchange: result.exchange
          });
          checkpoint.activeTickers++;
          console.log(`✅ ${ticker} is ACTIVE - $${result.price} (${result.exchange})`);
          logTicker(ticker, 'ACTIVE', result.exchange, result.price);
        } else {
          await db.upsertTicker(ticker, 'delisted', {
            exchange: result.exchange
          });
          checkpoint.delistedTickers++;
          console.log(`⚰️ ${ticker} is DELISTED (${result.exchange})`);
          logTicker(ticker, 'DELISTED', result.exchange);
        }
        
        checkpoint.processed++;
        checkpoint.currentIndex = i + 1;
        checkpoint.lastProcessedTicker = ticker;
        checkpoint.timestamp = new Date().toISOString();
        
        // Save progress every ticker
        saveCheckpoint(checkpoint);
        
        // Export to JSON files every 10 tickers
        if (checkpoint.processed % SAVE_EVERY === 0) {
          console.log(`💾 Saving database progress... (${checkpoint.processed} processed)`);
          await db.exportToJSON();
        }
        
        await sleep(100); // Rate limiting
        
      } catch (error) {
        console.error(`❌ Error processing ${ticker}: ${error.message}`);
        logTicker(ticker, 'ERROR', 'UNKNOWN');
      }
      
      // Progress update every 50 tickers
      if ((i + 1) % 50 === 0) {
        const progress = ((i + 1) / allTickers.length * 100).toFixed(2);
        console.log(`\n📊 Progress: ${progress}% - Active: ${checkpoint.activeTickers}, Delisted: ${checkpoint.delistedTickers}\n`);
      }
    }
    
    // Final save
    console.log('\n🎉 Discovery complete! Performing final save...');
    await db.exportToJSON();
    
    // Get final stats
    const stats = await db.getStats();
    console.log(`✅ Final results - Active: ${stats.active}, Delisted: ${stats.delisted}, Total: ${stats.total}`);
    
    // Clean up checkpoint
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('🧹 Checkpoint file cleaned up');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during discovery:', error);
  } finally {
    await db.close();
  }
  
  console.log('\n✅ Database ticker discovery completed!');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Discovery interrupted by user.');
  console.log('💾 Progress has been saved. You can resume by running the script again.');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Discovery terminated.');
  await db.close();
  process.exit(0);
});

// Start discovery
discoverAllTickers().catch(async error => {
  console.error('💥 Fatal error:', error);
  await db.close();
  process.exit(1);
});
