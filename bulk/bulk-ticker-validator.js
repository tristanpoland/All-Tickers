#!/usr/bin/env node

import fs from 'node:fs';
import yahooFinance from 'yahoo-finance2';
import path from 'node:path';
import TickerDatabase from '../ticker-database.js';
import GoogleSheetsIntegration from '../google-sheets-integration.js';

// Suppress yahoo-finance2 validation logging
yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false
  }
});

/**
 * Bulk Ticker Validator
 * Validates all "delisted" tickers in the database to find which ones are actually active
 * Much more efficient than the slow combinatorial search approach
 */

class BulkTickerValidator {
  constructor() {
    this.db = null;
    this.sheets = null;
    this.stats = {
      processed: 0,
      foundActive: 0,
      confirmedDelisted: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async init() {
    this.db = new TickerDatabase();
    await this.db.init();

    // Optional Google Sheets integration
    if (fs.existsSync('../google-credentials.json') && fs.existsSync('../sheets-config.json')) {
      try {
        const config = JSON.parse(fs.readFileSync('../sheets-config.json', 'utf8'));
        this.sheets = new GoogleSheetsIntegration();
        await this.sheets.init('../google-credentials.json', config.spreadsheetId);
        console.log('📊 Google Sheets integration enabled');
      } catch (error) {
        console.log('⚠️  Google Sheets integration failed, continuing without:', error.message);
        this.sheets = null;
      }
    }
  }

  // US exchange validation (same logic as other validation scripts)
  isValidUSExchange(exchange) {
    if (!exchange) return false;
    
    const validExchanges = [
      'NYSE', 'NasdaqGS', 'NasdaqGM', 'NasdaqCM', 'NYSEArca', 'NYSE American',
      'NYSE MKT', 'NASDAQ', 'NYSE Arca'
    ];
    
    return validExchanges.some(valid => 
      exchange.toLowerCase().includes(valid.toLowerCase()) ||
      valid.toLowerCase().includes(exchange.toLowerCase())
    );
  }

  // Validate a single ticker
  async validateTicker(ticker) {
    try {
      const quote = await yahooFinance.quote(ticker);
      
      // Check if we have valid data
      if (!quote || !quote.regularMarketPrice || !quote.currency) {
        return { status: "delisted" };
      }
      
      // Validate US exchange
      if (!this.isValidUSExchange(quote.fullExchangeName)) {
        return { status: "delisted" };
      }
      
      // Check for valid price
      if (typeof quote.regularMarketPrice !== 'number' || quote.regularMarketPrice <= 0) {
        return { status: "delisted" };
      }
      
      return {
        status: "active",
        price: quote.regularMarketPrice,
        currency: quote.currency || 'USD',
        exchange: quote.fullExchangeName
      };
      
    } catch (error) {
      // Schema validation errors or network errors usually mean delisted/invalid
      return { status: "delisted" };
    }
  }

  // Process a batch of tickers
  async processBatch(tickers, batchNumber, totalBatches) {
    console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${tickers.length} tickers)`);
    
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      
      try {
        const result = await this.validateTicker(ticker);
        this.stats.processed++;
        
        if (result.status === 'active') {
          // Found an active ticker!
          this.stats.foundActive++;
          console.log(`✅ ${ticker} - ACTIVE (${result.exchange}) $${result.price}`);
          
          // Update database
          await this.db.upsertTicker(ticker, 'active', {
            price: result.price,
            exchange: result.exchange,
            currency: result.currency
          });
          
          // Update Google Sheets if enabled
          if (this.sheets) {
            await this.sheets.updateTicker(ticker, 'active', result);
          }
          
        } else {
          // Confirmed delisted
          this.stats.confirmedDelisted++;
          if (this.stats.processed % 100 === 0) {
            // Only log every 100th delisted to avoid spam
            console.log(`💭 ${ticker} - confirmed delisted (${this.stats.processed} processed)`);
          }
        }
        
        // Rate limiting - 1.5 second delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Progress update every 50 tickers
        if (this.stats.processed % 50 === 0) {
          const elapsed = (Date.now() - this.stats.startTime) / 1000;
          const rate = this.stats.processed / elapsed;
          const remaining = await this.db.countTickersByStatus('delisted') - this.stats.processed;
          const eta = remaining / rate / 60; // minutes
          
          console.log(`📊 Progress: ${this.stats.processed.toLocaleString()} processed | Active: ${this.stats.foundActive} | Rate: ${rate.toFixed(2)}/sec | ETA: ${eta.toFixed(0)}min`);
        }
        
      } catch (error) {
        this.stats.errors++;
        console.error(`❌ Error validating ${ticker}:`, error.message);
      }
    }
  }

  // Main validation process
  async validateAll(options = {}) {
    const {
      batchSize = 100,
      startIndex = 0,
      maxTickers = null,
      resumeFrom = null
    } = options;

    console.log('🚀 Bulk Ticker Validation\n');
    
    // Get all delisted tickers
    const delistedTickers = await this.db.getTickersByStatus('delisted');
    console.log(`📊 Found ${delistedTickers.length.toLocaleString()} tickers to validate`);
    
    if (delistedTickers.length === 0) {
      console.log('ℹ️  No delisted tickers to validate. Run bulk-ticker-generator.js first.');
      return;
    }

    // Apply filters
    let tickersToProcess = delistedTickers.slice(startIndex);
    if (maxTickers) {
      tickersToProcess = tickersToProcess.slice(0, maxTickers);
    }
    
    console.log(`🎯 Will validate ${tickersToProcess.length.toLocaleString()} tickers`);
    console.log(`⚙️  Batch size: ${batchSize}`);
    console.log(`⏱️  Rate limit: 1.5 seconds per ticker`);
    console.log(`📈 Estimated time: ${((tickersToProcess.length * 1.5) / 60).toFixed(0)} minutes\n`);

    // Process in batches
    const totalBatches = Math.ceil(tickersToProcess.length / batchSize);
    
    for (let i = 0; i < tickersToProcess.length; i += batchSize) {
      const batch = tickersToProcess.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      await this.processBatch(batch, batchNumber, totalBatches);
      
      // Save progress periodically
      if (batchNumber % 10 === 0) {
        console.log('💾 Exporting progress to JSON...');
        await this.db.exportToJSON();
      }
    }

    // Final summary
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    console.log('\n🎉 Bulk validation completed!');
    console.log(`📊 Final stats:`);
    console.log(`   Processed: ${this.stats.processed.toLocaleString()}`);
    console.log(`   Found Active: ${this.stats.foundActive.toLocaleString()}`);
    console.log(`   Confirmed Delisted: ${this.stats.confirmedDelisted.toLocaleString()}`);
    console.log(`   Errors: ${this.stats.errors.toLocaleString()}`);
    console.log(`   Time: ${(elapsed / 60).toFixed(1)} minutes`);
    console.log(`   Rate: ${(this.stats.processed / elapsed).toFixed(2)} tickers/second`);

    // Export final results
    console.log('\n📁 Exporting final results...');
    await this.db.exportToJSON();
    
    if (this.sheets) {
      console.log('📊 Updating Google Sheets...');
      await this.sheets.exportTickers(this.db);
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    batchSize: 100,
    startIndex: 0,
    maxTickers: null
  };
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || 100;
        break;
      case '--start-index':
        options.startIndex = parseInt(args[++i]) || 0;
        break;
      case '--max-tickers':
        options.maxTickers = parseInt(args[++i]) || null;
        break;
      case '--help':
        console.log(`
🎯 Bulk Ticker Validator

Usage: node bulk-ticker-validator.js [options]

Options:
  --batch-size <n>     Number of tickers per batch [default: 100]
  --start-index <n>    Skip first N tickers [default: 0]
  --max-tickers <n>    Validate only N tickers [default: all]
  --help              Show this help

Examples:
  node bulk-ticker-validator.js                    # Validate all delisted tickers
  node bulk-ticker-validator.js --max-tickers 1000 # Validate first 1000 only
  node bulk-ticker-validator.js --start-index 5000 # Skip first 5000 tickers
        `);
        process.exit(0);
    }
  }

  const validator = new BulkTickerValidator();
  
  try {
    await validator.init();
    await validator.validateAll(options);
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  } finally {
    await validator.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Validation interrupted by user.');
  console.log('💡 Progress has been saved. You can resume later.');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export default BulkTickerValidator;
