import { eodhdService } from '../src/services/eodhd';
import { writeFileSync } from 'fs';

async function inspectEodhdData() {
  console.log('🔍 Inspecting EODHD Fundamentals Response...\n');
  
  const ticker = 'SPY';
  
  try {
    console.log(`Fetching fundamentals for ${ticker}...`);
    const fundamentals = await eodhdService.getEtfFundamentals(ticker);
    
    if (!fundamentals) {
      console.log('❌ No data returned');
      return;
    }
    
    // Save full response to file for inspection
    writeFileSync('eodhd-response.json', JSON.stringify(fundamentals, null, 2));
    console.log('✅ Full response saved to: eodhd-response.json');
    console.log('');
    
    // Check structure
    console.log('Response Structure:');
    console.log('==================');
    console.log('General:', fundamentals.General ? '✓' : '✗');
    console.log('ETF_Data:', fundamentals.ETF_Data ? '✓' : '✗');
    console.log('');
    
    if (fundamentals.ETF_Data) {
      console.log('ETF_Data Contents:');
      console.log('  Holdings:', fundamentals.ETF_Data.Holdings ? '✓' : '✗');
      console.log('  Sector_Weights:', fundamentals.ETF_Data.Sector_Weights ? '✓' : '✗');
      console.log('  Asset_Allocation:', fundamentals.ETF_Data.Asset_Allocation ? '✓' : '✗');
      console.log('');
      
      // Check Holdings structure
      if (fundamentals.ETF_Data.Holdings) {
        const holdingsKeys = Object.keys(fundamentals.ETF_Data.Holdings);
        console.log(`  Holdings Count: ${holdingsKeys.length}`);
        
        if (holdingsKeys.length > 0) {
          console.log('\n  First 3 Holdings:');
          holdingsKeys.slice(0, 3).forEach(key => {
            const holding = fundamentals.ETF_Data.Holdings[key];
            console.log(`    ${key}:`, JSON.stringify(holding, null, 6));
          });
          
          // Check what fields exist
          const firstHolding = fundamentals.ETF_Data.Holdings[holdingsKeys[0]];
          console.log('\n  Available fields in first holding:');
          Object.keys(firstHolding).forEach(field => {
            console.log(`    - ${field}: ${JSON.stringify(firstHolding[field])}`);
          });
        } else {
          console.log('  ⚠️ Holdings object is empty');
        }
      }
      
      // Check Sector_Weights structure
      if (fundamentals.ETF_Data.Sector_Weights) {
        const sectorKeys = Object.keys(fundamentals.ETF_Data.Sector_Weights);
        console.log(`\n  Sector_Weights Count: ${sectorKeys.length}`);
        
        if (sectorKeys.length > 0) {
          console.log('\n  First 3 Sectors:');
          sectorKeys.slice(0, 3).forEach(key => {
            const sector = fundamentals.ETF_Data.Sector_Weights[key];
            console.log(`    ${key}:`, JSON.stringify(sector, null, 6));
          });
        } else {
          console.log('  ⚠️ Sector_Weights object is empty');
        }
      }
      
      // Check all top-level keys in ETF_Data
      console.log('\n  All ETF_Data keys:');
      Object.keys(fundamentals.ETF_Data).forEach(key => {
        const value = fundamentals.ETF_Data[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = typeof value === 'object' && value !== null 
          ? `(${Object.keys(value).length} keys)`
          : String(value).substring(0, 50);
        console.log(`    - ${key}: ${type} ${preview}`);
      });
    }
    
    console.log('\n✅ Inspection complete. Check eodhd-response.json for full data.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

inspectEodhdData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });
