#!/usr/bin/env node

/**
 * Update Master List
 * 
 * This script exports the current database contents to update the master-list.json
 * and other output files. Run this after validation to get the latest results.
 */

import TickerDatabase from './ticker-database.js';

async function updateMasterList() {
  const db = new TickerDatabase();
  
  try {
    console.log('🚀 Updating master list from database...\n');
    
    console.log('📊 Connecting to database...');
    await db.init();
    
    // Get current stats
    const stats = await db.getStats();
    console.log('\n📈 Current Database Stats:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Active: ${stats.active}`);
    console.log(`   Delisted: ${stats.delisted}`);
    
    // Export to JSON files
    console.log('\n📤 Exporting to JSON files...');
    const exported = await db.exportToJSON();
    
    console.log('\n✅ Master list update completed successfully!');
    console.log('📁 Files updated:');
    console.log('   • output/active_tickers.json');
    console.log('   • output/delisted_tickers.json');
    console.log('   • output/master-list.json');
    console.log('   • output/tickers_status.txt');
    
    // Show file sizes
    console.log('\n📊 Export Summary:');
    console.log(`   • Master List: ${stats.total} tickers`);
    console.log(`   • Active: ${stats.active} tickers`);
    console.log(`   • Delisted: ${stats.delisted} tickers`);
    
    // Show recent activity
    console.log('\n🕒 Recent Activity:');
    const recent = await db.getRecentActivity(5);
    if (recent.length === 0) {
      console.log('   No recent activity');
    } else {
      recent.forEach(ticker => {
        const time = new Date(ticker.updated_at).toLocaleString();
        const status = ticker.status === 'active' ? '✅ ACTIVE' : '❌ DELISTED';
        console.log(`   • ${ticker.symbol} → ${status} (${time})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Master list update failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Check if this is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateMasterList();
}

export default updateMasterList;
