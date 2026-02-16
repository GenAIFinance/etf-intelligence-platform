// Diagnostic: Check EODHD API Response for Investment Fields
// Save as: apps/api/scripts/diagnose-missing-fields.ts
// Run: cd apps/api && npx tsx scripts/diagnose-missing-fields.ts

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from apps/api/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const EODHD_API_KEY = process.env.EODHD_API_KEY;

async function diagnoseMissingFields() {
  console.log('🔍 Diagnosing Missing Investment Fields\n');
  console.log('='.repeat(60));

  // Check API key
  if (!EODHD_API_KEY) {
    console.error('\n❌ ERROR: EODHD_API_KEY not found');
    console.error('Please add it to apps/api/.env file:');
    console.error('EODHD_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log('✓ API Key found');

  // Test with multiple popular ETFs
  const testTickers = ['SPY', 'VOO', 'QQQ'];
  
  for (const ticker of testTickers) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📡 Testing: ${ticker}`);
      console.log('='.repeat(60));
      
      const response = await axios.get(
        `https://eodhistoricaldata.com/api/fundamentals/${ticker}.US`,
        {
          params: {
            api_token: EODHD_API_KEY,
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const data = response.data;

      // Check main sections
      console.log('\n📊 Available Sections:', Object.keys(data).join(', '));

      // Check ETF_Data section (critical for investment fields)
      if (data.ETF_Data) {
        console.log('\n✅ ETF_Data section EXISTS');
        console.log('   Subsections:', Object.keys(data.ETF_Data).join(', '));

        // Check Asset Allocation
        if (data.ETF_Data.Asset_Allocation) {
          console.log('\n   ✅ Asset_Allocation found:');
          const aa = data.ETF_Data.Asset_Allocation;
          
          if (aa.Stock) {
            console.log('      Stock data:', JSON.stringify(aa.Stock, null, 2));
          }
          if (aa.Bond) {
            console.log('      Bond data:', JSON.stringify(aa.Bond, null, 2));
          }
          if (aa.Cash) {
            console.log('      Cash data:', JSON.stringify(aa.Cash, null, 2));
          }
          if (aa.Other) {
            console.log('      Other data:', JSON.stringify(aa.Other, null, 2));
          }
        } else {
          console.log('\n   ❌ Asset_Allocation MISSING');
        }

        // Check Market Capitalization
        if (data.ETF_Data.MorningStar?.Market_Capitalization) {
          console.log('\n   ✅ Market_Capitalization found:');
          console.log('      Data:', JSON.stringify(data.ETF_Data.MorningStar.Market_Capitalization, null, 2));
        } else if (data.ETF_Data.Market_Capitalisation) {
          console.log('\n   ✅ Market_Capitalisation found (UK spelling):');
          console.log('      Data:', JSON.stringify(data.ETF_Data.Market_Capitalisation, null, 2));
        } else {
          console.log('\n   ❌ Market Cap data MISSING');
        }

        // Check Valuations
        if (data.ETF_Data.Valuations_Growth) {
          console.log('\n   ✅ Valuations_Growth found:');
          console.log('      Data:', JSON.stringify(data.ETF_Data.Valuations_Growth, null, 2));
        } else {
          console.log('\n   ❌ Valuations_Growth MISSING');
        }

        // Check Expense Ratio
        if (data.ETF_Data.ExpenseRatio) {
          console.log('\n   ✅ ExpenseRatio:', data.ETF_Data.ExpenseRatio);
        } else if (data.ETF_Data.NetExpenseRatio) {
          console.log('\n   ✅ NetExpenseRatio:', data.ETF_Data.NetExpenseRatio);
        } else {
          console.log('\n   ❌ ExpenseRatio MISSING');
        }

      } else {
        console.log('\n❌ ETF_Data section MISSING - Cannot extract investment fields!');
      }

      // Show first 3000 characters of response
      console.log('\n📋 Sample API Response:');
      console.log(JSON.stringify(data, null, 2).substring(0, 3000));
      console.log('\n... (truncated)\n');

      // Success - break after first successful ticker
      console.log('\n✅ Diagnostic complete for', ticker);
      break;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`\n❌ API Error for ${ticker}:`, error.response?.status, error.response?.statusText);
        if (error.response?.status === 401) {
          console.error('   Invalid API key!');
          process.exit(1);
        }
        if (error.response?.status === 404) {
          console.error(`   Ticker ${ticker} not found, trying next...`);
          continue;
        }
      } else {
        console.error(`\n❌ Error for ${ticker}:`, error);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✓ Diagnostic complete!\n');
  
  console.log('💡 NEXT STEPS:');
  console.log('   1. Check if ETF_Data section exists above');
  console.log('   2. Look at the field names in Asset_Allocation');
  console.log('   3. Share this output to get the sync service fix');
  console.log('   4. The correct field names will be used to update the sync\n');
}

diagnoseMissingFields().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
