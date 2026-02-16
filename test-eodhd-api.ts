import { eodhdService } from '../src/services/eodhd';
import { config } from '../src/config';

async function testEodhdApi() {
  console.log('🔍 Testing EODHD API Connection...\n');
  
  console.log('Configuration:');
  console.log(`  API Key: ${config.eodhd.apiKey ? config.eodhd.apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`  Base URL: ${config.eodhd.baseUrl}`);
  console.log('');

  const testTicker = 'SPY';
  
  try {
    console.log(`📊 Test 1: Fetching fundamentals for ${testTicker}...`);
    const fundamentals = await eodhdService.getEtfFundamentals(testTicker);
    
    if (!fundamentals) {
      console.log('  ❌ No data returned (null)');
      return;
    }
    
    console.log('  ✅ Fundamentals retrieved successfully!');
    console.log(`  - Name: ${fundamentals.General?.Name}`);
    console.log(`  - Exchange: ${fundamentals.General?.Exchange}`);
    console.log(`  - Description: ${fundamentals.General?.Description?.substring(0, 100)}...`);
    
    // Check ETF_Data
    if (fundamentals.ETF_Data) {
      console.log('\n  ETF_Data section found:');
      console.log(`  - Total Assets: ${fundamentals.ETF_Data.TotalAssets}`);
      console.log(`  - Annual Holdings Turnover: ${fundamentals.ETF_Data.AnnualHoldingsTurnover}`);
      console.log(`  - Inception Date: ${fundamentals.ETF_Data.Inception_Date}`);
      
      // Check Holdings
      if (fundamentals.ETF_Data.Holdings) {
        const holdingsCount = Object.keys(fundamentals.ETF_Data.Holdings).length;
        console.log(`  - Holdings Count: ${holdingsCount}`);
        
        if (holdingsCount > 0) {
          console.log('\n  Sample Holdings (first 5):');
          const holdings = Object.entries(fundamentals.ETF_Data.Holdings).slice(0, 5);
          holdings.forEach(([key, holding]: [string, any]) => {
            console.log(`    - ${holding.Code}: ${holding.Name} (${holding.Assets_Percentage}%)`);
          });
        } else {
          console.log('  ⚠️ Holdings object exists but is empty');
        }
      } else {
        console.log('  ❌ No Holdings data in ETF_Data');
      }
      
      // Check Sector Weights
      if (fundamentals.ETF_Data.Sector_Weights) {
        const sectorCount = Object.keys(fundamentals.ETF_Data.Sector_Weights).length;
        console.log(`  - Sector Weights Count: ${sectorCount}`);
        
        if (sectorCount > 0) {
          console.log('\n  Sample Sectors (first 3):');
          const sectors = Object.entries(fundamentals.ETF_Data.Sector_Weights).slice(0, 3);
          sectors.forEach(([sector, data]: [string, any]) => {
            console.log(`    - ${sector}: ${data.Equity_Percentage}%`);
          });
        }
      } else {
        console.log('  ❌ No Sector_Weights data in ETF_Data');
      }
    } else {
      console.log('  ❌ No ETF_Data section in fundamentals response');
    }
    
    // Test price data
    console.log('\n📈 Test 2: Fetching price data...');
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const today = new Date();
    
    const prices = await eodhdService.getHistoricalPrices(
      testTicker,
      oneYearAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
    
    console.log(`  ✅ Retrieved ${prices.length} price bars`);
    
    if (prices.length > 0) {
      const latest = prices[prices.length - 1];
      console.log(`  Latest price (${latest.date}): $${latest.close}`);
      console.log(`  Sample: Open: $${latest.open}, High: $${latest.high}, Low: $${latest.low}`);
    } else {
      console.log('  ⚠️ No price data returned');
    }
    
    console.log('\n✅ All API tests passed!');
    console.log('\nConclusion: EODHD API is working correctly.');
    console.log('The issue may be in the sync logic or error handling.');
    
  } catch (error: any) {
    console.error('\n❌ API Test Failed!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.error('\n⚠️ Authentication failed - check your API key!');
    } else if (error.response?.status === 403) {
      console.error('\n⚠️ Access forbidden - your API key may not have access to this endpoint');
    } else if (error.response?.status === 404) {
      console.error('\n⚠️ Ticker not found');
    }
  }
}

testEodhdApi()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script error:', error);
    process.exit(1);
  });
