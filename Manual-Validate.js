import fs from 'node:fs';
import yahooFinance from 'yahoo-finance2';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to log messages to both console and file
function logMessage(message) {
  console.log(message);
  fs.appendFileSync('log.txt', message + '\n');
}

// Function to test a ticker
async function testTicker(ticker) {
  const timestamp = new Date().toISOString();
  logMessage(`\n=== Testing Ticker: ${ticker} ===`);
  logMessage(`Timestamp: ${timestamp}`);
  logMessage('-----------------------------------');
  
  try {
    logMessage(`Attempting to fetch quote for ${ticker}...`);
    const quote = await yahooFinance.quote(ticker);
    
    logMessage('✅ SUCCESS - Quote retrieved successfully!');
    logMessage(`Symbol: ${quote.symbol || 'N/A'}`);
    logMessage(`Price: $${quote.regularMarketPrice || 'N/A'}`);
    logMessage(`Exchange: ${quote.fullExchangeName || quote.exchange || 'N/A'}`);
    logMessage(`Currency: ${quote.currency || 'N/A'}`);
    logMessage(`Market State: ${quote.marketState || 'N/A'}`);
    logMessage(`Quote Type: ${quote.quoteType || 'N/A'}`);
    
    // Log complete object structure
    logMessage('\n--- Full Quote Object ---');
    const quoteStr = JSON.stringify(quote, null, 2);
    logMessage(quoteStr);
    
  } catch (error) {
    logMessage('❌ ERROR - Failed to fetch quote');
    logMessage(`Error Type: ${error.constructor.name}`);
    logMessage(`Error Message: ${error.message}`);
    
    // Check for specific Yahoo validation errors
    if (error.message.includes('Expected union value')) {
      logMessage('🔍 Detected: "Expected union value" error');
    }
    
    if (error.message.includes('Failed Yahoo Schema validation')) {
      logMessage('🔍 Detected: "Failed Yahoo Schema validation" error');
    }
    
    // Log complete error details
    logMessage('\n--- Complete Error Details ---');
    const errorStr = error.toString();
    logMessage(errorStr);
  }
  
  logMessage('-----------------------------------');
  logMessage('Test completed.\n');
}

// Function to ask user for ticker input
function askForTicker() {
  rl.question('Enter ticker symbol to test (or "quit" to exit): ', async (input) => {
    const ticker = input.trim().toUpperCase();
    
    if (ticker === 'QUIT' || ticker === 'EXIT') {
      logMessage('Goodbye!');
      rl.close();
      return;
    }
    
    if (!ticker) {
      console.log('Please enter a valid ticker symbol.');
      askForTicker();
      return;
    }
    
    await testTicker(ticker);
    askForTicker(); // Ask for next ticker
  });
}

// Main function
function main() {
  // Clear log file at start
  fs.writeFileSync('log.txt', `=== Yahoo Finance Ticker Testing Log ===\nStarted: ${new Date().toISOString()}\n\n`);
  
  console.log('🔍 Yahoo Finance Ticker Tester');
  console.log('===============================');
  console.log('This tool will test any ticker symbol and log the results to log.txt');
  console.log('Enter ticker symbols to test their Yahoo Finance API responses.\n');
  
  askForTicker();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logMessage('\n🛑 Testing interrupted by user.');
  rl.close();
  process.exit(0);
});

// Start the program
main();
