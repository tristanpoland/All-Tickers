const yahooFinance = require('yahoo-finance2').default;
const fs = require('fs');
const path = require('path');
const Database = require('sqlite3').Database;

// Suppress Yahoo Finance validation warnings and errors
yahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical']);

// Additional error suppression - redirect console errors during processing
const originalConsoleError = console.error;
let suppressErrors = false;
let capturedValidationWarnings = new Set();

function toggleErrorSuppression(suppress) {
    suppressErrors = suppress;
    if (suppress) {
        console.error = (...args) => {
            // Capture validation warnings for problematic tickers
            const message = args.join(' ');
            if (message.includes('validation') || message.includes('Expected union value') || 
                message.includes('yahoo-finance2') || message.includes('gadicc')) {
                
                // Try to extract ticker symbol from the error context if possible
                // This is a best-effort attempt to identify which ticker caused the warning
                const currentTicker = getCurrentProcessingTicker();
                if (currentTicker) {
                    capturedValidationWarnings.add(currentTicker);
                }
                return; // Suppress these errors
            }
            originalConsoleError.apply(console, args); // Allow other errors through
        };
    } else {
        console.error = originalConsoleError;
    }
}

// Track the currently processing ticker for validation warning capture
let currentProcessingTicker = null;
function setCurrentProcessingTicker(ticker) {
    currentProcessingTicker = ticker;
}
function getCurrentProcessingTicker() {
    return currentProcessingTicker;
}
function hasValidationWarning(ticker) {
    return capturedValidationWarnings.has(ticker);
}

class TickerDataDatabase {
    constructor() {
        const dbPath = path.join(__dirname, '..', 'db', 'ticker_data.db');
        this.db = new Database(dbPath);
        
        // Also connect to the validation database to mark inactive tickers
        const validationDbPath = path.join(__dirname, '..', 'db', 'tickers.db');
        this.validationDb = new Database(validationDbPath);
        
        this.initializeDatabase();
    }

    initializeDatabase() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ticker_data (
                ticker TEXT PRIMARY KEY,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                json_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        this.db.run(createTableSQL, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('✅ Database initialized successfully');
            }
        });
    }

    async insertOrUpdateTicker(ticker, jsonData) {
        return new Promise((resolve, reject) => {
           const sql = `
                INSERT OR REPLACE INTO ticker_data (ticker, last_updated, json_data)
                VALUES (?, CURRENT_TIMESTAMP, ?)
            `;
            
            this.db.run(sql, [ticker, JSON.stringify(jsonData)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ ticker, rowId: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getTickerCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM ticker_data', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    async getRecentlyUpdated(limit = 10) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT ticker, last_updated 
                FROM ticker_data 
                ORDER BY last_updated DESC 
                LIMIT ?
            `;
            
            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async isTickerRecentlyChecked(ticker, hoursAgo = 24) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT ticker, last_updated,
                       (julianday('now') - julianday(last_updated)) * 24 as hours_diff
                FROM ticker_data 
                WHERE ticker = ? 
                AND (julianday('now') - julianday(last_updated)) * 24 < ?
            `;
            
            this.db.get(sql, [ticker, hoursAgo], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        isRecent: !!row,
                        lastUpdated: row ? row.last_updated : null,
                        hoursSince: row ? Math.round(row.hours_diff * 100) / 100 : null
                    });
                }
            });
        });
    }

    async markTickerInactive(ticker, reason = 'Schema validation error') {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE tickers 
                SET active = 0, price = -1, exchange = ? 
                WHERE ticker = ?
            `;
            
            this.validationDb.run(sql, [`INACTIVE_${reason}`, ticker], function(err) {
                if (err) {
                    console.log(`⚠️  Could not mark ${ticker} as inactive in validation DB: ${err.message}`);
                    reject(err);
                } else {
                    console.log(`🔄 Marked ${ticker} as inactive due to: ${reason}`);
                    resolve({ ticker, changes: this.changes });
                }
            });
        });
    }

    close() {
        return new Promise((resolve) => {
            // Close main database
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing main database:', err);
                }
                
                // Close validation database
                this.validationDb.close((err2) => {
                    if (err2) {
                        console.error('Error closing validation database:', err2);
                    } else {
                        console.log('✅ Database connections closed');
                    }
                    resolve();
                });
            });
        });
    }
}

async function getTickerData(symbol) {
    try {
        // Set current ticker for validation warning tracking
        setCurrentProcessingTicker(symbol);
        
        // Get comprehensive ticker data with error suppression
        const quote = await yahooFinance.quote(symbol, {}, { validateResult: false });
        const historicalData = await yahooFinance.historical(symbol, {
            period1: '2001-01-01',
            period2: new Date().toISOString().split('T')[0],
            interval: '1d'
        }, { validateResult: false });
        const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics', 'assetProfile']
        }, { validateResult: false });

        // Check if this ticker had validation warnings
        const hadValidationWarnings = hasValidationWarning(symbol);
        
        // Clear current ticker
        setCurrentProcessingTicker(null);

        // Create structured data with metadata
        const tickerDataWithMetadata = {
            metadata: {
                symbol: symbol,
                fetchDate: new Date().toISOString(),
                dataSource: 'Yahoo Finance API (yahoo-finance2)',
                version: '2.0.0',
                hadValidationWarnings: hadValidationWarnings,
                historicalPeriod: {
                    start: '2001-01-01',
                    end: new Date().toISOString().split('T')[0]
                },
                recordCount: {
                    historical: historicalData ? historicalData.length : 0,
                    summaryModules: summary ? Object.keys(summary).length : 0
                }
            },
            quote: quote,
            historical: historicalData,
            summary: summary,
            statistics: {
                // Calculate basic statistics from historical data
                historicalStats: historicalData && historicalData.length > 0 ? {
                    totalDays: historicalData.length,
                    averageClose: (historicalData.reduce((sum, day) => sum + (day.close || 0), 0) / historicalData.length).toFixed(2),
                    highestClose: Math.max(...historicalData.map(day => day.close || 0)).toFixed(2),
                    lowestClose: Math.min(...historicalData.map(day => day.close || 0)).toFixed(2),
                    averageVolume: Math.round(historicalData.reduce((sum, day) => sum + (day.volume || 0), 0) / historicalData.length),
                    priceChange: historicalData.length > 1 ? 
                        ((historicalData[historicalData.length - 1].close - historicalData[0].close) / historicalData[0].close * 100).toFixed(2) + '%' 
                        : 'N/A'
                } : null
            }
        };

        return tickerDataWithMetadata;
        
    } catch (error) {
        // Clear current ticker
        setCurrentProcessingTicker(null);
        
        // Detect schema/validation errors
        const isSchemaError = error.message && (
            error.message.includes('Expected union value') ||
            error.message.includes('validation') ||
            error.message.includes('schema') ||
            error.message.includes('Invalid response') ||
            error.message.toLowerCase().includes('yahoo-finance2')
        );
        
        return {
            metadata: {
                symbol: symbol,
                fetchDate: new Date().toISOString(),
                dataSource: 'Yahoo Finance API (yahoo-finance2)',
                version: '2.0.0',
                error: error.message,
                errorType: isSchemaError ? 'SCHEMA_VALIDATION' : 'API_ERROR',
                hadValidationWarnings: hasValidationWarning(symbol)
            },
            quote: null,
            historical: null,
            summary: null,
            statistics: null
        };
    }
}

async function saveTickerDataToDB(symbol, database) {
    try {
        const data = await getTickerData(symbol);
        
        // Check if this is a schema validation error OR had validation warnings
        const hasSchemaIssues = (data.metadata.error && data.metadata.errorType === 'SCHEMA_VALIDATION') || 
                               data.metadata.hadValidationWarnings;
        
        if (hasSchemaIssues) {
            // Mark as inactive in validation database
            try {
                const reason = data.metadata.error ? 'Schema validation error' : 'Validation warnings';
                await database.markTickerInactive(symbol, reason);
            } catch (markError) {
                // Continue even if marking inactive fails
                console.log(`⚠️  Warning: Could not mark ${symbol} as inactive: ${markError.message}`);
            }
            
            // Don't save problematic data to the main database
            return { 
                symbol, 
                success: false, 
                error: data.metadata.error || 'Validation warnings detected - marked as inactive',
                errorType: 'SCHEMA_VALIDATION'
            };
        }
        
        // Save to database (only clean data without validation issues)
        await database.insertOrUpdateTicker(symbol, data);
        
        return { symbol, success: !data.metadata.error, data };
        
    } catch (error) {
        return { symbol, success: false, error: error.message };
    }
}

async function loadActiveTickers() {
    try {
        // Load active tickers directly from the database
        const validationDbPath = path.join(__dirname, '..', 'db', 'tickers.db');
        const db = new Database(validationDbPath);
        
        return new Promise((resolve, reject) => {
            const query = 'SELECT ticker FROM tickers WHERE active = 1 ORDER BY ticker';
            
            db.all(query, (err, rows) => {
                db.close();
                
                if (err) {
                    reject(new Error(`Failed to load active tickers from database: ${err.message}`));
                } else {
                    const tickers = rows.map(row => row.ticker);
                    resolve(tickers);
                }
            });
        });
        
    } catch (error) {
        throw new Error(`Failed to load active tickers: ${error.message}`);
    }
}

// Process all active tickers from active_tickers.json
async function processAllActiveTickers() {
    console.log('🚀 Processing all active tickers with comprehensive data...');
    
    const database = new TickerDataDatabase();
    
    try {
        // Enable error suppression for cleaner output
        toggleErrorSuppression(true);
        
        // Load active tickers from the JSON file
        const activeTickers = await loadActiveTickers();
        console.log(`📊 Found ${activeTickers.length} active tickers to process`);
        
        if (activeTickers.length === 0) {
            console.log('❌ No active tickers found to process');
            await database.close();
            return [];
        }
        
        const results = [];
        const errors = [];
        const schemaErrors = [];
        let processed = 0;
        
        console.log('⚡ Starting batch processing...\n');
        
        // Process tickers in batches to avoid overwhelming the API
        const batchSize = 25; // Much smaller batch size to be more respectful of API limits
        let skipped = 0;
        
        for (let i = 0; i < activeTickers.length; i += batchSize) {
            const batch = activeTickers.slice(i, i + batchSize);
            
            // Process current batch sequentially to avoid API rate limits
            for (const symbol of batch) {
                try {
                    // Check if ticker was updated in the last 24 hours
                    const recentCheck = await database.isTickerRecentlyChecked(symbol, 24);
                    
                    if (recentCheck.isRecent) {
                        skipped++;
                        
                        // Show skip message occasionally for transparency
                        if (skipped % 50 === 1 || skipped <= 10) {
                            console.log(`⏭️  Skipping ${symbol} (updated ${recentCheck.hoursSince}h ago)`);
                        }
                        
                        processed++; // Count as processed for progress tracking
                        continue;
                    }
                    
                    const result = await saveTickerDataToDB(symbol, database);
                    processed++;
                    
                    // Show progress every 10 tickers for better visibility
                    if (processed % 10 === 0 || processed === activeTickers.length) {
                        const percentage = ((processed / activeTickers.length) * 100).toFixed(1);
                        const dbCount = await database.getTickerCount();
                        console.log(`📈 Progress: ${processed}/${activeTickers.length} (${percentage}%) - Latest: ${symbol} - DB Records: ${dbCount} - Skipped: ${skipped}`);
                    }
                    
                    if (result.success) {
                        results.push(result);
                    } else {
                        if (result.errorType === 'SCHEMA_VALIDATION') {
                            schemaErrors.push({ symbol, error: result.error || 'Schema validation error' });
                        } else {
                            errors.push({ symbol, error: result.error || 'Unknown error' });
                        }
                    }
                } catch (error) {
                    errors.push({ symbol, error: error.message });
                }
                
                // Add much longer delay between each request to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between requests
            }
            
            // Add much longer delay between batches
            if (i + batchSize < activeTickers.length) {
                console.log(`⏸️  Batch ${Math.floor(i/batchSize) + 1} completed. Pausing for 10 seconds to respect API limits...`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay between batches
            }
        }
        
        // Get final database statistics
        const finalDbCount = await database.getTickerCount();
        const recentUpdates = await database.getRecentlyUpdated(5);
        
        // Summary
        console.log('\n🎉 Processing completed!');
        console.log(`✅ Successfully processed: ${results.length} tickers`);
        console.log(`❌ Failed to process: ${errors.length} tickers`);
        console.log(`� Schema errors (marked inactive): ${schemaErrors.length} tickers`);
        console.log(`�💾 Total records in database: ${finalDbCount}`);
        
        const totalProcessed = results.length + errors.length + schemaErrors.length;
        const successRate = ((results.length / totalProcessed) * 100).toFixed(1);
        console.log(`📊 Success rate: ${successRate}%`);
        
        console.log('\n📝 Recently updated tickers:');
        recentUpdates.forEach(ticker => {
            console.log(`   ${ticker.ticker} - ${ticker.last_updated}`);
        });
        
        if (errors.length > 0) {
            console.log('\n📋 Failed tickers (first 20):');
            errors.slice(0, 20).forEach(error => {
                console.log(`   ${error.symbol}: ${error.error}`);
            });
            if (errors.length > 20) {
                console.log(`   ... and ${errors.length - 20} more`);
            }
        }
        
        if (schemaErrors.length > 0) {
            console.log('\n🔄 Schema errors - marked as inactive (first 10):');
            schemaErrors.slice(0, 10).forEach(error => {
                console.log(`   ${error.symbol}: ${error.error}`);
            });
            if (schemaErrors.length > 10) {
                console.log(`   ... and ${schemaErrors.length - 10} more`);
            }
        }
        
        // Create a summary file
        const summaryData = {
            processedDate: new Date().toISOString(),
            totalTickers: activeTickers.length,
            successfullyProcessed: results.length,
            failed: errors.length,
            schemaErrors: schemaErrors.length,
            successRate: `${successRate}%`,
            databaseRecords: finalDbCount,
            databasePath: path.join(__dirname, 'ticker_data.db'),
            recentUpdates: recentUpdates,
            errors: errors.slice(0, 100), // Limit errors in summary to first 100
            schemaErrorTickers: schemaErrors.slice(0, 50) // Limit schema errors to first 50
        };
        
        const outputDir = path.join(__dirname, '..', '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const summaryPath = path.join(outputDir, 'Error-Summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
        
        console.log(`\n📄 Processing summary saved to: ${summaryPath}`);
        console.log(`💾 Database location: ${path.join(__dirname, '..', 'db', 'ticker_data.db')}`);
        
        // Restore error logging
        toggleErrorSuppression(false);
        
        await database.close();
        return results;
        
    } catch (error) {
        console.error('❌ Error processing active tickers:', error.message);
        toggleErrorSuppression(false);
        await database.close();
        return [];
    }
}

// Run the processing
if (require.main === module) {
    processAllActiveTickers();
}