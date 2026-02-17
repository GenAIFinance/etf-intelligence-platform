import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const EODHD_API_TOKEN = process.env.EODHD_API_TOKEN || '6982994b580bc8.97426481';

// Helper to safely parse floats and avoid NaN
function safeParseFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

async function quickSync() {
  console.log('🚀 Starting quick sync of 30 popular ETFs...\n');
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected\n');
    
    const popularETFs = [
      'SPY', 'QQQ', 'IVV', 'VOO', 'VTI', 'IWM', 'EEM', 'VEA', 'AGG', 'BND',
      'VWO', 'LQD', 'GLD', 'VNQ', 'VIG', 'EFA', 'IEFA', 'TLT', 'XLF', 'XLE',
      'XLK', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'VTV', 'VUG', 'VXUS', 'VO'
    ];
    
    console.log(`📋 Processing ${popularETFs.length} ETFs\n`);
    
    let successCount = 0;
    
    for (let i = 0; i < popularETFs.length; i++) {
      const ticker = popularETFs[i];
      
      try {
        console.log(`[${i + 1}/${popularETFs.length}] ${ticker}...`);
        
        const response = await axios.get(
          `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${EODHD_API_TOKEN}`,
          { timeout: 10000 }
        );
        
        const data = response.data;
        
        // Extract data with correct field names and NaN protection
        const etfData = {
          ticker,
          name: data.General?.Name || ticker,
          assetClass: data.General?.Category || 'Equity',
          exchange: data.General?.Exchange || 'US',
          country: data.General?.CountryISO || 'US',
          currency: data.General?.CurrencyCode || 'USD',
          
          // Use correct field names from schema
          aum: safeParseFloat(data.ETF_Data?.Net_Assets),
          netExpenseRatio: safeParseFloat(data.ETF_Data?.Expense_Ratio) ? safeParseFloat(data.ETF_Data?.Expense_Ratio)! / 100 : null,
          
          // Optional fields
          strategyType: data.General?.Type || null,
          summary: data.General?.Description || null,
          inceptionDate: data.General?.InceptionDate ? new Date(data.General.InceptionDate) : null,
          
          // Allocations with NaN protection
          equityAllocation: safeParseFloat(data.ETF_Data?.Asset_Allocation?.Equity),
          bondAllocation: safeParseFloat(data.ETF_Data?.Asset_Allocation?.Bond),
          cashAllocation: safeParseFloat(data.ETF_Data?.Asset_Allocation?.Cash),
          otherAllocation: safeParseFloat(data.ETF_Data?.Asset_Allocation?.Other),
          
          // Valuation metrics
          priceToBook: safeParseFloat(data.ETF_Data?.Valuations_Growth?.Price_Book),
          priceToSales: safeParseFloat(data.ETF_Data?.Valuations_Growth?.Price_Sales),
          priceToCashFlow: safeParseFloat(data.ETF_Data?.Valuations_Growth?.Price_Cash_Flow),
          
          // Other metrics
          turnover: safeParseFloat(data.ETF_Data?.Annual_Holdings_Turnover),
        };
        
        await prisma.etf.upsert({
          where: { ticker },
          update: {
            name: etfData.name,
            assetClass: etfData.assetClass,
            aum: etfData.aum,
            netExpenseRatio: etfData.netExpenseRatio,
            strategyType: etfData.strategyType,
            summary: etfData.summary,
            inceptionDate: etfData.inceptionDate,
            equityAllocation: etfData.equityAllocation,
            bondAllocation: etfData.bondAllocation,
            cashAllocation: etfData.cashAllocation,
            otherAllocation: etfData.otherAllocation,
            priceToBook: etfData.priceToBook,
            priceToSales: etfData.priceToSales,
            priceToCashFlow: etfData.priceToCashFlow,
            turnover: etfData.turnover,
            updatedAt: new Date(),
          },
          create: etfData,
        });
        
        console.log(`✓ ${ticker} - ${etfData.name}`);
        successCount++;
        
        // Rate limit: 50ms between requests
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error: any) {
        console.error(`✗ ${ticker}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Successfully synced ${successCount}/${popularETFs.length} ETFs!`);
    
    const count = await prisma.etf.count();
    console.log(`💾 Total ETFs in database: ${count}\n`);
    
    console.log('🌐 Refresh your website to see the data!');
    console.log('   https://etf-intelligence-platform.vercel.app\n');
    
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickSync();