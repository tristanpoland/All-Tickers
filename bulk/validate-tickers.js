const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

class TickerValidator {
    constructor() {
        this.dbPath = path.join(__dirname, 'tickers.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.batchSize = 100; // Process in batches to avoid overwhelming the API
        this.delayMs = 1000; // Delay between batches to be respectful to APIs
    }

    // Get tickers that haven't been validated yet (active = false)
    async getUnvalidatedTickers(limit = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT ticker FROM tickers WHERE active = 0';
            if (limit) {
                query += ` LIMIT ${limit}`;
            }
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.ticker));
                }
            });
        });
    }

    // Validate a single ticker using Yahoo Finance API
    async validateTicker(ticker) {
        try {
            // Using Yahoo Finance API endpoint
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result.length > 0) {
                const result = response.data.chart.result[0];
                const meta = result.meta;
                
                if (meta && meta.regularMarketPrice) {
                    return {
                        active: true,
                        price: meta.regularMarketPrice,
                        exchange: meta.exchangeName || 'Unknown'
                    };
                }
            }
            
            return { active: false, price: null, exchange: null };
            
        } catch (error) {
            // If we get a 404 or similar, the ticker is likely inactive
            if (error.response && error.response.status === 404) {
                return { active: false, price: null, exchange: null };
            }
            
            // For other errors, we'll treat as inactive but log the error
            console.warn(`⚠️  Error validating ${ticker}: ${error.message}`);
            return { active: false, price: null, exchange: null };
        }
    }

    // Update ticker in database with validation results
    async updateTicker(ticker, validationResult) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE tickers 
                SET active = ?, price = ?, exchange = ?
                WHERE ticker = ?
            `;
            
            this.db.run(query, [
                validationResult.active ? 1 : 0,
                validationResult.price,
                validationResult.exchange,
                ticker
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Process a batch of tickers
    async processBatch(tickers) {
        const results = {
            validated: 0,
            active: 0,
            inactive: 0,
            errors: 0
        };

        console.log(`🔍 Validating batch of ${tickers.length} tickers...`);
        
        for (const ticker of tickers) {
            try {
                const validationResult = await this.validateTicker(ticker);
                await this.updateTicker(ticker, validationResult);
                
                results.validated++;
                if (validationResult.active) {
                    results.active++;
                    console.log(`✅ ${ticker} - Active (${validationResult.exchange}) - $${validationResult.price}`);
                } else {
                    results.inactive++;
                }
                
                // Small delay to be respectful to APIs
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                results.errors++;
                console.error(`❌ Error processing ${ticker}:`, error.message);
            }
        }
        
        return results;
    }

    // Get current database statistics
    async getStats() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_count,
                    SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as inactive_count,
                    COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as validated_count
                FROM tickers
            `;
            
            this.db.get(query, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get sample of active tickers
    async getActiveSample(limit = 10) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT ticker, price, exchange 
                FROM tickers 
                WHERE active = 1 
                ORDER BY ticker 
                LIMIT ?
            `;
            
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Close database connection
    close() {
        this.db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err);
            } else {
                console.log('✅ Database connection closed');
            }
        });
    }
}

// Main execution
async function main() {
    console.log('🔍 All-Tickers Bulk Validator v2.0');
    console.log('===================================');
    
    const validator = new TickerValidator();
    
    try {
        // Get initial stats
        const initialStats = await validator.getStats();
        console.log(`📊 Database contains ${initialStats.total} total tickers`);
        console.log(`✅ Active: ${initialStats.active_count}`);
        console.log(`❌ Inactive: ${initialStats.inactive_count}`);
        console.log(`🔍 Validated: ${initialStats.validated_count}`);
        
        // Parse command line arguments
        const args = process.argv.slice(2);
        const limitIndex = args.indexOf('--limit');
        const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1]) : null;
        const dryRun = args.includes('--dry-run');
        
        if (dryRun) {
            console.log('🧪 DRY RUN MODE - No database updates will be made');
        }
        
        // Get tickers to validate
        const tickersToValidate = await validator.getUnvalidatedTickers(limit);
        
        if (tickersToValidate.length === 0) {
            console.log('🎉 All tickers have been validated!');
            
            // Show sample of active tickers
            const activeSample = await validator.getActiveSample();
            if (activeSample.length > 0) {
                console.log('\n📈 Sample of active tickers:');
                activeSample.forEach(ticker => {
                    console.log(`   ${ticker.ticker} - ${ticker.exchange} - $${ticker.price}`);
                });
            }
            
            validator.close();
            return;
        }
        
        console.log(`🎯 Found ${tickersToValidate.length} tickers to validate`);
        if (limit) {
            console.log(`📊 Limited to ${limit} tickers`);
        }
        
        if (dryRun) {
            console.log(`🧪 Would validate: ${tickersToValidate.slice(0, 10).join(', ')}${tickersToValidate.length > 10 ? '...' : ''}`);
            validator.close();
            return;
        }
        
        // Process tickers in batches
        const totalResults = {
            validated: 0,
            active: 0,
            inactive: 0,
            errors: 0
        };
        
        const startTime = Date.now();
        
        for (let i = 0; i < tickersToValidate.length; i += validator.batchSize) {
            const batch = tickersToValidate.slice(i, i + validator.batchSize);
            const batchResults = await validator.processBatch(batch);
            
            // Accumulate results
            totalResults.validated += batchResults.validated;
            totalResults.active += batchResults.active;
            totalResults.inactive += batchResults.inactive;
            totalResults.errors += batchResults.errors;
            
            // Show progress
            const progress = Math.round(((i + batch.length) / tickersToValidate.length) * 100);
            console.log(`📊 Progress: ${progress}% (${i + batch.length}/${tickersToValidate.length})`);
            console.log(`📈 Batch Results: ${batchResults.active} active, ${batchResults.inactive} inactive`);
            
            // Delay between batches
            if (i + validator.batchSize < tickersToValidate.length) {
                console.log(`⏳ Waiting ${validator.delayMs}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, validator.delayMs));
            }
        }
        
        // Final statistics
        const endTime = Date.now();
        const finalStats = await validator.getStats();
        
        console.log('\n🎉 Validation Complete!');
        console.log(`⏱️  Total time: ${Math.round((endTime - startTime) / 1000)}s`);
        console.log(`📊 Processed: ${totalResults.validated} tickers`);
        console.log(`✅ Found active: ${totalResults.active}`);
        console.log(`❌ Inactive: ${totalResults.inactive}`);
        console.log(`⚠️  Errors: ${totalResults.errors}`);
        console.log(`\n📈 Final Database Stats:`);
        console.log(`   Total: ${finalStats.total}`);
        console.log(`   Active: ${finalStats.active_count}`);
        console.log(`   Inactive: ${finalStats.inactive_count}`);
        console.log(`   Validated: ${finalStats.validated_count}`);
        
        // Show sample of newly found active tickers
        if (totalResults.active > 0) {
            const activeSample = await validator.getActiveSample();
            console.log('\n🔍 Sample of active tickers:');
            activeSample.forEach(ticker => {
                console.log(`   ${ticker.ticker} - ${ticker.exchange} - $${ticker.price}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error during validation:', error);
        process.exit(1);
    } finally {
        validator.close();
    }
}

// Handle command line execution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TickerValidator;
