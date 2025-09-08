import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = './output/tickers.db';

class TickerDatabase {
  constructor() {
    this.db = null;
  }
  
  // Initialize database connection and create tables
  async init() {
    this.db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    // Create tickers table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickers (
        symbol TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('active', 'delisted')),
        price REAL,
        currency TEXT DEFAULT 'USD',
        exchange TEXT,
        last_validated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for faster status queries
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickers_status ON tickers(status)
    `);
    
    console.log('📊 Database initialized successfully');
  }
  
  // Add or update a ticker
  async upsertTicker(symbol, status, details = {}) {
    const { price, currency = 'USD', exchange } = details;
    
    await this.db.run(`
      INSERT INTO tickers (symbol, status, price, currency, exchange, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(symbol) DO UPDATE SET
        status = excluded.status,
        price = excluded.price,
        currency = excluded.currency,
        exchange = excluded.exchange,
        updated_at = CURRENT_TIMESTAMP
    `, [symbol, status, price, currency, exchange]);
    
    console.log(`💾 ${symbol} → ${status} (${exchange || 'Unknown'})`);
  }
  
  // Get all tickers by status
  async getTickersByStatus(status) {
    const rows = await this.db.all(`
      SELECT symbol FROM tickers 
      WHERE status = ? 
      ORDER BY symbol
    `, [status]);
    
    return rows.map(row => row.symbol);
  }
  
  // Get ticker details
  async getTickerDetails(symbol) {
    return await this.db.get(`
      SELECT * FROM tickers WHERE symbol = ?
    `, [symbol]);
  }
  
  // Move ticker to different status
  async moveTickerToStatus(symbol, newStatus, details = {}) {
    const { price, exchange } = details;
    
    await this.db.run(`
      UPDATE tickers 
      SET status = ?, price = ?, exchange = ?, updated_at = CURRENT_TIMESTAMP
      WHERE symbol = ?
    `, [newStatus, price, exchange, symbol]);
    
    console.log(`🔄 ${symbol} moved to ${newStatus}`);
  }
  
  // Import from JSON files (for migration or initial setup)
  async importFromJSON() {
    try {
      let imported = 0;
      
      // Import active tickers
      if (fs.existsSync('./output/active_tickers.json')) {
        const activeData = JSON.parse(fs.readFileSync('./output/active_tickers.json', 'utf8'));
        for (const ticker of activeData) {
          await this.upsertTicker(ticker, 'active');
          imported++;
        }
        console.log(`📥 Imported ${activeData.length} active tickers`);
      }
      
      // Import delisted tickers
      if (fs.existsSync('./output/delisted_tickers.json')) {
        const delistedData = JSON.parse(fs.readFileSync('./output/delisted_tickers.json', 'utf8'));
        for (const ticker of delistedData) {
          await this.upsertTicker(ticker, 'delisted');
          imported++;
        }
        console.log(`📥 Imported ${delistedData.length} delisted tickers`);
      }
      
      console.log(`✅ Total imported: ${imported} tickers`);
      return imported;
      
    } catch (error) {
      console.error('❌ Error importing from JSON:', error.message);
      return 0;
    }
  }

  // Export to JSON files (for compatibility)
  async exportToJSON() {
    const activeTickers = await this.getTickersByStatus('active');
    const delistedTickers = await this.getTickersByStatus('delisted');
    
    // Ensure output directory exists
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write JSON files
    fs.writeFileSync('./output/active_tickers.json', JSON.stringify(activeTickers, null, 2));
    fs.writeFileSync('./output/delisted_tickers.json', JSON.stringify(delistedTickers, null, 2));
    
    // Create master list with ticker status
    const masterList = [
      ...activeTickers.map(ticker => ({ [ticker]: true })),
      ...delistedTickers.map(ticker => ({ [ticker]: false }))
    ];
    fs.writeFileSync('./output/master-list.json', JSON.stringify(masterList, null, 2));
    
    // Write status file
    const statusEntries = [
      ...activeTickers.map(ticker => `"${ticker}:ACTIVE"`),
      ...delistedTickers.map(ticker => `"${ticker}:DELISTED"`)
    ];
    fs.writeFileSync('./output/tickers_status.txt', statusEntries.join(','));
    
    console.log(`📁 Exported: ${activeTickers.length} active, ${delistedTickers.length} delisted`);
    console.log(`📋 Master list created: ${masterList.length} total tickers`);
    return { active: activeTickers.length, delisted: delistedTickers.length };
  }
  
  // Import from existing JSON files
  async importFromJSON() {
    const activeFile = './output/active_tickers.json';
    const delistedFile = './output/delisted_tickers.json';
    
    let imported = 0;
    
    // Import active tickers
    if (fs.existsSync(activeFile)) {
      const activeTickers = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
      for (const ticker of activeTickers) {
        await this.upsertTicker(ticker, 'active');
        imported++;
      }
    }
    
    // Import delisted tickers
    if (fs.existsSync(delistedFile)) {
      const delistedTickers = JSON.parse(fs.readFileSync(delistedFile, 'utf8'));
      for (const ticker of delistedTickers) {
        await this.upsertTicker(ticker, 'delisted');
        imported++;
      }
    }
    
    console.log(`📥 Imported ${imported} tickers from JSON files`);
    return imported;
  }
  
  // Get statistics
  async getStats() {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'delisted' THEN 1 ELSE 0 END) as delisted
      FROM tickers
    `);
    
    return stats;
  }
  
  // Get recent activity
  async getRecentActivity(limit = 10) {
    return await this.db.all(`
      SELECT symbol, status, price, exchange, updated_at
      FROM tickers 
      ORDER BY updated_at DESC 
      LIMIT ?
    `, [limit]);
  }
  
  // Clear all data from the database
  async clearAll() {
    await this.db.run('DELETE FROM tickers');
    console.log('🗑️  All ticker data cleared from database');
  }
  
  // Close database connection
  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

export default TickerDatabase;
