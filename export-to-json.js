import TickerDatabase from './ticker-database.js';

async function exportToJSON() {
  const db = new TickerDatabase();
  
  try {
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
    
    console.log('\n✅ Export completed successfully!');
    console.log('📁 Files created:');
    console.log('   • output/active_tickers.json');
    console.log('   • output/delisted_tickers.json');
    console.log('   • output/master-list.json');
    console.log('   • output/tickers_status.txt');
    
    // Show recent activity
    console.log('\n🕒 Recent Activity:');
    const recent = await db.getRecentActivity(5);
    recent.forEach(ticker => {
      const time = new Date(ticker.updated_at).toLocaleString();
      console.log(`   • ${ticker.symbol} → ${ticker.status} (${time})`);
    });
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
  } finally {
    await db.close();
  }
}

// Check if this is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportToJSON();
}

export default exportToJSON;
