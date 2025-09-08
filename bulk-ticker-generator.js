#!/usr/bin/env node

import fs from 'node:fs';
import TickerDatabase from './ticker-database.js';

/**
 * Bulk Ticker Generator
 * Creates all possible ticker combinations and adds them to the database as "delisted"
 * Then we can validate them to find which ones are actually active
 */

class BulkTickerGenerator {
  constructor() {
    this.db = null;
    this.letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  async init() {
    this.db = new TickerDatabase();
    await this.db.init();
  }

  // Generate all possible tickers of a given length
  generateTickersOfLength(length) {
    const tickers = [];
    const totalCombinations = Math.pow(26, length);
    
    for (let i = 0; i < totalCombinations; i++) {
      let ticker = '';
      let temp = i;
      
      for (let pos = 0; pos < length; pos++) {
        ticker = this.letters[temp % 26] + ticker;
        temp = Math.floor(temp / 26);
      }
      
      tickers.push(ticker);
    }
    
    return tickers;
  }

  // Generate all tickers from 1 to maxLength letters
  generateAllTickers(maxLength = 4) {
    console.log(`🔄 Generating all possible tickers (1-${maxLength} letters)...\n`);
    
    const allTickers = [];
    
    for (let length = 1; length <= maxLength; length++) {
      const lengthTickers = this.generateTickersOfLength(length);
      allTickers.push(...lengthTickers);
      
      console.log(`✅ Generated ${lengthTickers.length.toLocaleString()} ${length}-letter tickers`);
    }
    
    console.log(`\n📊 Total tickers generated: ${allTickers.length.toLocaleString()}`);
    return allTickers;
  }

  // Bulk insert all tickers as "delisted" into database
  async bulkInsertTickers(tickers) {
    console.log(`\n🔄 Inserting ${tickers.length.toLocaleString()} tickers into database...`);
    
    const batchSize = 1000;
    let inserted = 0;
    let skipped = 0;
    
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      
      for (const ticker of batch) {
        try {
          // Check if ticker already exists
          const existing = await this.db.getTickerDetails(ticker);
          if (existing) {
            skipped++;
          } else {
            await this.db.upsertTicker(ticker, 'delisted', {
              price: null,
              exchange: null,
              generated: true // Mark as auto-generated
            });
            inserted++;
          }
        } catch (error) {
          console.error(`❌ Error inserting ${ticker}:`, error.message);
        }
      }
      
      // Progress update
      const processed = Math.min(i + batchSize, tickers.length);
      const percentage = ((processed / tickers.length) * 100).toFixed(2);
      process.stdout.write(`\r📝 Progress: ${processed.toLocaleString()}/${tickers.length.toLocaleString()} (${percentage}%) | Inserted: ${inserted.toLocaleString()} | Skipped: ${skipped.toLocaleString()}`);
    }
    
    console.log(`\n\n✅ Bulk insert completed!`);
    console.log(`📊 Inserted: ${inserted.toLocaleString()} new tickers`);
    console.log(`⏭️  Skipped: ${skipped.toLocaleString()} existing tickers`);
    
    return { inserted, skipped };
  }

  // Generate and populate all tickers
  async populateAllTickers(options = {}) {
    const {
      maxLength = 4,
      includeExisting = false,
      dryRun = false
    } = options;

    console.log('🚀 Bulk Ticker Population\n');
    console.log('Configuration:');
    console.log(`📏 Max ticker length: ${maxLength} letters`);
    console.log(`🔄 Include existing: ${includeExisting ? 'Yes' : 'No'}`);
    console.log(`🧪 Dry run: ${dryRun ? 'Yes' : 'No'}`);
    console.log('');

    // Calculate expected totals
    let expectedTotal = 0;
    for (let i = 1; i <= maxLength; i++) {
      expectedTotal += Math.pow(26, i);
    }
    console.log(`📈 Expected ticker combinations: ${expectedTotal.toLocaleString()}`);

    if (dryRun) {
      console.log('\n🧪 DRY RUN - No actual database changes will be made');
      return { inserted: 0, skipped: 0, total: expectedTotal };
    }

    // Get current database stats
    const currentStats = await this.db.getStats();
    console.log(`\n📊 Current database: ${currentStats.total.toLocaleString()} total tickers`);
    
    if (!includeExisting && currentStats.total > 0) {
      console.log('⚠️  Database already contains tickers. Use --include-existing to add to existing data.');
      return { inserted: 0, skipped: currentStats.total, total: expectedTotal };
    }

    // Generate all tickers
    const allTickers = this.generateAllTickers(maxLength);
    
    // Insert into database
    const result = await this.bulkInsertTickers(allTickers);
    
    // Final stats
    const finalStats = await this.db.getStats();
    console.log(`\n📈 Final database stats:`);
    console.log(`   Total: ${finalStats.total.toLocaleString()}`);
    console.log(`   Active: ${finalStats.active.toLocaleString()}`);
    console.log(`   Delisted: ${finalStats.delisted.toLocaleString()}`);
    
    return { ...result, total: expectedTotal };
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
    maxLength: 4,
    includeExisting: false,
    dryRun: false
  };
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-length':
        options.maxLength = parseInt(args[++i]) || 4;
        break;
      case '--include-existing':
        options.includeExisting = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
🎯 Bulk Ticker Generator

Usage: node bulk-ticker-generator.js [options]

Options:
  --max-length <n>     Maximum ticker length (1-5) [default: 4]
  --include-existing   Add to existing database [default: false]
  --dry-run           Show what would be done without making changes
  --help              Show this help

Examples:
  node bulk-ticker-generator.js                    # Generate 1-4 letter tickers
  node bulk-ticker-generator.js --max-length 3     # Generate 1-3 letter tickers only  
  node bulk-ticker-generator.js --dry-run          # Preview what would be generated
  node bulk-ticker-generator.js --include-existing # Add to existing database
        `);
        process.exit(0);
    }
  }

  const generator = new BulkTickerGenerator();
  
  try {
    await generator.init();
    const result = await generator.populateAllTickers(options);
    
    console.log('\n🎉 Bulk ticker generation completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: npm run validate-active    # Find active tickers');
    console.log('   2. Run: npm run validate-delisted  # Confirm delisted ones');
    console.log('   3. Run: npm run export-sheets      # Export to Google Sheets');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  } finally {
    await generator.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Generation interrupted by user.');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export default BulkTickerGenerator;
