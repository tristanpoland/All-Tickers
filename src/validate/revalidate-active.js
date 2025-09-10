#!/usr/bin/env node
// Re-validate active tickers to check if any have become inactive

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

class ActiveTickerRevalidator {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'db', 'tickers.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.concurrentRequests = 8; // Conservative concurrency for active ticker validation
        this.batchSize = 500;
        this.retryDelay = 750; // 750ms between batches
    }

    // Get all active tickers from database
    async getActiveTickers() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT ticker, price, exchange
                FROM tickers 
                WHERE active = 1
                ORDER BY ticker
            `;
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Validate a single ticker using Yahoo Finance
    async validateTicker(ticker) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
            const response = await axios.get(url, {
                timeout: 7000,
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
            
            return { active: false, price: -1, exchange: 'DELISTED' };
            
        } catch (error) {
            // Network errors or 404s might indicate delisted tickers
            if (error.response && error.response.status === 404) {
                return { active: false, price: -1, exchange: 'NOT_FOUND' };
            }
            return { active: false, price: -1, exchange: 'ERROR' };
        }
    }

    // Validate multiple tickers concurrently
    async validateTickersConcurrent(tickers) {
        const promises = tickers.map(tickerInfo => 
            this.validateTicker(tickerInfo.ticker).then(result => ({ 
                ticker: tickerInfo.ticker,
                oldPrice: tickerInfo.price,
                oldExchange: tickerInfo.exchange,
                ...result 
            }))
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
                    exchange: 'ERROR',
                    oldPrice: -1,
                    oldExchange: 'UNKNOWN'
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
            let nowInactive = 0;
            let priceUpdates = 0;
            
            tickerResults.forEach(({ ticker, active, price, exchange, oldPrice }) => {
                stmt.run([
                    active ? 1 : 0,
                    price,
                    exchange,
                    ticker
                ], (err) => {
                    if (err) {
                        errors++;
                        console.error(`❌ Error updating ${ticker}:`, err.message);
                    } else {
                        if (!active) {
                            nowInactive++;
                        } else if (oldPrice !== price) {
                            priceUpdates++;
                        }
                    }
                    
                    completed++;
                    
                    if (completed === tickerResults.length) {
                        this.db.run('COMMIT');
                        stmt.finalize();
                        resolve({ completed, errors, nowInactive, priceUpdates });
                    }
                });
            });
        });
    }

    // Main revalidation process
    async revalidateActiveTickers() {
        console.log('🔍 Starting revalidation of active tickers...\n');
        
        // Get all active tickers
        const activeTickers = await this.getActiveTickers();
        console.log(`📊 Found ${activeTickers.length.toLocaleString()} active tickers to revalidate\n`);
        
        if (activeTickers.length === 0) {
            console.log('✅ No active tickers found to revalidate!');
            return;
        }
        
        let totalProcessed = 0;
        let totalNowInactive = 0;
        let totalPriceUpdates = 0;
        let totalErrors = 0;
        
        // Process in batches
        for (let i = 0; i < activeTickers.length; i += this.batchSize) {
            const batch = activeTickers.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(activeTickers.length / this.batchSize);
            
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
                
                // Show any tickers that became inactive or had significant price changes
                chunkResults.forEach(({ ticker, active, price, exchange, oldPrice, oldExchange }) => {
                    if (!active) {
                        console.log(`⚠️  ${ticker} is now inactive: ${oldExchange} → ${exchange}`);
                    } else if (Math.abs(price - oldPrice) / oldPrice > 0.1) {
                        // Show significant price changes (>10%)
                        const change = ((price - oldPrice) / oldPrice * 100).toFixed(1);
                        console.log(`📈 ${ticker}: $${oldPrice.toFixed(2)} → $${price.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)`);
                    }
                });
                
                // Small delay between chunks
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
            
            // Update database with batch results
            try {
                const updateResults = await this.updateDatabase(batchResults);
                totalProcessed += updateResults.completed;
                totalNowInactive += updateResults.nowInactive;
                totalPriceUpdates += updateResults.priceUpdates;
                totalErrors += updateResults.errors;
                
                console.log(`💾 Batch ${batchNum} completed: ${updateResults.nowInactive} became inactive, ${updateResults.priceUpdates} price updates`);
                
                // Progress update
                const progress = ((i + batch.length) / activeTickers.length * 100).toFixed(1);
                console.log(`📈 Progress: ${progress}% (${totalNowInactive} now inactive, ${totalPriceUpdates} price updates so far)\n`);
                
            } catch (error) {
                console.error('❌ Batch update failed:', error);
                totalErrors += batch.length;
            }
            
            // Longer delay between batches to be respectful to the API
            if (i + this.batchSize < activeTickers.length) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        // Final summary
        console.log('🎉 Active ticker revalidation completed!');
        console.log('==========================================');
        console.log(`📊 Total tickers processed: ${totalProcessed.toLocaleString()}`);
        console.log(`⚠️  Tickers now inactive: ${totalNowInactive.toLocaleString()}`);
        console.log(`📈 Price updates: ${totalPriceUpdates.toLocaleString()}`);
        console.log(`❌ Errors: ${totalErrors.toLocaleString()}`);
        
        if (totalNowInactive > 0) {
            console.log(`\n🔍 Found ${totalNowInactive} tickers that are no longer active`);
            console.log('💡 Consider running export scripts to update your output files');
        }
        
        if (totalPriceUpdates > 0) {
            console.log(`\n📊 Updated prices for ${totalPriceUpdates} tickers`);
        }
        
        if (totalNowInactive === 0 && totalPriceUpdates === 0) {
            console.log('\n✅ All active tickers are still active with current prices!');
        }
        
        // Calculate data freshness metrics
        const inactiveRate = (totalNowInactive / totalProcessed * 100).toFixed(2);
        const updateRate = (totalPriceUpdates / totalProcessed * 100).toFixed(2);
        console.log(`\n📊 Data Quality Metrics:`);
        console.log(`   Inactive rate: ${inactiveRate}%`);
        console.log(`   Price update rate: ${updateRate}%`);
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

// Main execution
async function main() {
    const revalidator = new ActiveTickerRevalidator();
    
    try {
        await revalidator.revalidateActiveTickers();
    } catch (error) {
        console.error('💥 Active ticker revalidation failed:', error);
        process.exit(1);
    } finally {
        revalidator.close();
    }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Active ticker revalidation interrupted by user');
    console.log('💾 Progress has been saved to database');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { ActiveTickerRevalidator };
