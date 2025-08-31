import fs from 'node:fs';

// Test the format with a small sample
const active = ['VTI', 'VOO', 'SPY', 'QQQ'];
const delisted = ['FAKE1', 'FAKE2'];

const activeTxt = active.map(ticker => `"${ticker}:ACTIVE"`).join(',');
const delistedTxt = delisted.map(ticker => `"${ticker}:DELISTED"`).join(',');
const allStatusTxt = activeTxt + (activeTxt && delistedTxt ? ',' : '') + delistedTxt;

fs.writeFileSync('test_format.txt', allStatusTxt);
console.log('Test format created:');
console.log(allStatusTxt);
console.log('\nFile contents:');
console.log(fs.readFileSync('test_format.txt', 'utf8'));
