#!/usr/bin/env node
// Re-validate inactive tickers to check for missed active ones

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

class InactiveTickerRevalidator {
    constructor() {
        this.dbPath = path.join(__dirname, 'tickers.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.concurrentRequests = 10; // Lower concurrency for re-validation
        this.batchSize = 500;
        this.retryDelay = 500; // 500ms between batches
    }

    // Get all inactive tickers from database
    async getInactiveTickers() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT ticker 
                FROM tickers 
                WHERE active = 0 OR active IS NULL
                ORDER BY ticker
            `;
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.ticker));
                }
            });
        });
    }

    // Validate a single ticker using Yahoo Finance
    async validateTicker(ticker) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result.length > 0) {
                const result = response.data.chart.result[0];
                const meta = result.meta;
                
                if (meta && meta.regularMarketPrice && meta.exchangeName) {
                    return {
                        active: true,
                        price: meta.regularMarketPrice,
                        exchange: meta.exchangeName,
                        symbol: meta.symbol || ticker
                    };
                }
            }
            
            return { active: false, price: -1, exchange: 'INACTIVE' };
            
        } catch (error) {
            return { active: false, price: -1, exchange: 'ERROR' };
        }
    }

    // Validate multiple tickers concurrently
    async validateTickersConcurrent(tickers) {
        const promises = tickers.map(ticker => 
            this.validateTicker(ticker).then(result => ({ ticker, ...result }))
        );
        
        const results = await Promise.allSettled(promises);
        
        return results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    ticker: 'UNKNOWN',
                    active: false,
                    price: -1,
                    exchange: 'ERROR'
                };
            }
        });
    }

    // Update database with revalidation results
    async updateDatabase(tickerResults) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE tickers 
                SET active = ?, price = ?, exchange = ?
                WHERE ticker = ?
            `;
            
            const stmt = this.db.prepare(query);
            this.db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            let errors = 0;
            let foundActive = 0;
            
            tickerResults.forEach(({ ticker, active, price, exchange }) => {
                stmt.run([
                    active ? 1 : 0,
                    price,
                    exchange,
                    ticker
                ], (err) => {
                    if (err) {
                        errors++;
                        console.error(`❌ Error updating ${ticker}:`, err.message);
                    } else if (active) {
                        foundActive++;
                    }
                    
                    completed++;
                    
                    if (completed === tickerResults.length) {
                        this.db.run('COMMIT');
                        stmt.finalize();
                        resolve({ completed, errors, foundActive });
                    }
                });
            });
        });
    }

    // Main revalidation process
    async revalidateInactiveTickers() {
        console.log('🔍 Starting revalidation of inactive tickers...\n');
        
        // Get all inactive tickers
        const inactiveTickers = await this.getInactiveTickers();
        console.log(`📊 Found ${inactiveTickers.length.toLocaleString()} inactive tickers to revalidate\n`);
        
        if (inactiveTickers.length === 0) {
            console.log('✅ No inactive tickers found to revalidate!');
            return;
        }
        
        let totalProcessed = 0;
        let totalFoundActive = 0;
        let totalErrors = 0;
        
        // Process in batches
        for (let i = 0; i < inactiveTickers.length; i += this.batchSize) {
            const batch = inactiveTickers.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(inactiveTickers.length / this.batchSize);
            
            console.log(`🚀 Processing batch ${batchNum}/${totalBatches} (${batch.length} tickers)...`);
            
            // Process batch in smaller concurrent chunks
            const chunkSize = this.concurrentRequests;
            const chunks = [];
            for (let j = 0; j < batch.length; j += chunkSize) {
                chunks.push(batch.slice(j, j + chunkSize));
            }
            
            const batchResults = [];
            
            for (const chunk of chunks) {
                const chunkResults = await this.validateTickersConcurrent(chunk);
                batchResults.push(...chunkResults);
                
                // Show any newly found active tickers
                chunkResults.forEach(({ ticker, active, price, exchange }) => {
                    if (active) {
                        console.log(`✨ Found previously missed ticker: ${ticker} - ${exchange} - $${price}`);
                    }
                });
                
                // Small delay between chunks
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
            
            // Update database with batch results
            try {
                const updateResults = await this.updateDatabase(batchResults);
                totalProcessed += updateResults.completed;
                totalFoundActive += updateResults.foundActive;
                totalErrors += updateResults.errors;
                
                console.log(`💾 Batch ${batchNum} completed: ${updateResults.foundActive} new active tickers found`);
                
                // Progress update
                const progress = ((i + batch.length) / inactiveTickers.length * 100).toFixed(1);
                console.log(`📈 Progress: ${progress}% (${totalFoundActive} newly active tickers found so far)\n`);
                
            } catch (error) {
                console.error('❌ Batch update failed:', error);
                totalErrors += batch.length;
            }
            
            // Longer delay between batches to be respectful to the API
            if (i + this.batchSize < inactiveTickers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Final summary
        console.log('🎉 Revalidation completed!');
        console.log('==========================================');
        console.log(`📊 Total tickers processed: ${totalProcessed.toLocaleString()}`);
        console.log(`✨ Previously missed active tickers: ${totalFoundActive.toLocaleString()}`);
        console.log(`❌ Errors: ${totalErrors.toLocaleString()}`);
        
        if (totalFoundActive > 0) {
            console.log(`\n🎯 Success! Found ${totalFoundActive} tickers that were previously marked as inactive`);
            console.log('💡 Consider running export scripts to update your output files');
        } else {
            console.log('\n✅ No previously missed active tickers found - validation was accurate!');
        }
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

// Main execution
async function main() {
    const revalidator = new InactiveTickerRevalidator();
    
    try {
        await revalidator.revalidateInactiveTickers();
    } catch (error) {
        console.error('💥 Revalidation failed:', error);
        process.exit(1);
    } finally {
        revalidator.close();
    }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Revalidation interrupted by user');
    console.log('💾 Progress has been saved to database');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { InactiveTickerRevalidator };
