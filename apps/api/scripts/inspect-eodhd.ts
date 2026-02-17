import axios from 'axios';
import * as fs from 'fs';

const EODHD_API_TOKEN = process.env.EODHD_API_TOKEN || '6982994b580bc8.97426481';

async function inspectEODHDData() {
  console.log('🔍 EODHD API DATA STRUCTURE INSPECTION\n');
  console.log('Testing with SPY (SPDR S&P 500 ETF)\n');
  
  try {
    const response = await axios.get(
      `https://eodhd.com/api/fundamentals/SPY.US?api_token=${EODHD_API_TOKEN}`,
      { timeout: 15000 }
    );
    
    const data = response.data;
    
    console.log('✅ API Response received\n');
    console.log('=' .repeat(80));
    console.log('TOP-LEVEL KEYS:');
    console.log('=' .repeat(80));
    console.log(Object.keys(data).join(', '));
    console.log();
    
    // Save full response to file for inspection
    fs.writeFileSync('eodhd-spy-response.json', JSON.stringify(data, null, 2));
    console.log('📄 Full response saved to: eodhd-spy-response.json\n');
    
    // Check General section
    console.log('=' .repeat(80));
    console.log('GENERAL SECTION:');
    console.log('=' .repeat(80));
    if (data.General) {
      console.log('Keys:', Object.keys(data.General).join(', '));
      console.log('\nValues:');
      console.log('  Name:', data.General.Name);
      console.log('  Exchange:', data.General.Exchange);
      console.log('  Currency:', data.General.CurrencyCode);
      console.log('  Type:', data.General.Type);
      console.log('  Category:', data.General.Category);
      console.log('  InceptionDate:', data.General.InceptionDate);
    } else {
      console.log('❌ No General section found');
    }
    console.log();
    
    // Check ETF_Data section
    console.log('=' .repeat(80));
    console.log('ETF_DATA SECTION:');
    console.log('=' .repeat(80));
    if (data.ETF_Data) {
      console.log('Keys:', Object.keys(data.ETF_Data).join(', '));
      console.log('\nFinancial Data:');
      console.log('  Net_Assets:', data.ETF_Data.Net_Assets);
      console.log('  NAV:', data.ETF_Data.NAV);
      console.log('  Expense_Ratio:', data.ETF_Data.Expense_Ratio);
      console.log('  Yield:', data.ETF_Data.Yield);
      
      if (data.ETF_Data.Asset_Allocation) {
        console.log('\nAsset Allocation:');
        console.log('  ', JSON.stringify(data.ETF_Data.Asset_Allocation, null, 2));
      }
      
      if (data.ETF_Data.Market_Capitalisation) {
        console.log('\nMarket Cap Allocation:');
        console.log('  ', JSON.stringify(data.ETF_Data.Market_Capitalisation, null, 2));
      }
      
      if (data.ETF_Data.Valuations_Growth) {
        console.log('\nValuations & Growth:');
        console.log('  ', JSON.stringify(data.ETF_Data.Valuations_Growth, null, 2));
      }
    } else {
      console.log('❌ No ETF_Data section found');
    }
    console.log();
    
    // Check Holdings
    console.log('=' .repeat(80));
    console.log('HOLDINGS SECTION:');
    console.log('=' .repeat(80));
    if (data.Holdings) {
      const holdingsCount = Object.keys(data.Holdings).length;
      console.log(`✅ Found ${holdingsCount} holdings`);
      
      // Show first 3 holdings
      const holdingKeys = Object.keys(data.Holdings).slice(0, 3);
      console.log('\nSample Holdings:');
      holdingKeys.forEach(key => {
        const holding = data.Holdings[key];
        console.log(`  ${holding.Code || holding.Name}: ${holding.Assets}% (${holding.Name})`);
      });
    } else {
      console.log('❌ No Holdings section found');
    }
    console.log();
    
    // Check Technicals
    console.log('=' .repeat(80));
    console.log('TECHNICALS SECTION:');
    console.log('=' .repeat(80));
    if (data.Technicals) {
      console.log('Keys:', Object.keys(data.Technicals).join(', '));
      console.log('\nValues:');
      console.log('  Beta:', data.Technicals.Beta);
      console.log('  52WeekHigh:', data.Technicals['52WeekHigh']);
      console.log('  52WeekLow:', data.Technicals['52WeekLow']);
    } else {
      console.log('❌ No Technicals section found');
    }
    console.log();
    
    console.log('=' .repeat(80));
    console.log('\n📊 DIAGNOSIS:\n');
    
    const hasGeneral = !!data.General;
    const hasETFData = !!data.ETF_Data;
    const hasNetAssets = !!data.ETF_Data?.Net_Assets;
    const hasExpenseRatio = !!data.ETF_Data?.Expense_Ratio;
    const hasHoldings = !!data.Holdings;
    
    if (hasGeneral && hasETFData && hasNetAssets && hasExpenseRatio) {
      console.log('✅ EODHD API is returning complete data!');
      console.log('   Problem: Sync script field mappings may be incorrect');
      console.log('   Solution: Update sync script to match actual API structure');
    } else {
      console.log('⚠️  EODHD API response is incomplete:');
      if (!hasGeneral) console.log('   ❌ Missing General section');
      if (!hasETFData) console.log('   ❌ Missing ETF_Data section');
      if (!hasNetAssets) console.log('   ❌ Missing Net_Assets');
      if (!hasExpenseRatio) console.log('   ❌ Missing Expense_Ratio');
      if (!hasHoldings) console.log('   ⚠️  Missing Holdings');
      console.log('   Solution: Check EODHD API plan and permissions');
    }
    
    console.log('\n📄 Review eodhd-spy-response.json for complete structure\n');
    
  } catch (error: any) {
    console.error('❌ Failed to fetch data:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

inspectEODHDData();
