import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const EODHD_API_TOKEN = process.env.EODHD_API_TOKEN || '6982994b580bc8.97426481';
const PROGRESS_FILE = path.join(__dirname, 'sync-progress.json');

// Helper to safely parse floats and avoid NaN
function safeParseFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// Save progress to file for recovery
function saveProgress(processed: string[], failed: string[], stats: any) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ 
    processed, 
    failed, 
    stats,
    timestamp: new Date().toISOString() 
  }, null, 2));
}

// Load progress from file
function loadProgress(): { processed: string[], failed: string[] } {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return { processed: data.processed || [], failed: data.failed || [] };
    }
  } catch (error) {
    console.log('No previous progress found, starting fresh');
  }
  return { processed: [], failed: [] };
}

async function fullSync(forceRefresh: boolean = false) {
  console.log('🚀 FULL ETF SYNC - Complete Data Collection\n');
  console.log('⏰ Started at:', new Date().toLocaleString());
  console.log('📍 Expected duration: 4-5 hours for complete sync\n');
  
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  
  // Statistics tracking
  let fieldsPopulated = {
    aum: 0,
    netExpenseRatio: 0,
    inceptionDate: 0,
    assetAllocation: 0,
    valuations: 0
  };
  
  // Load previous progress if exists
  let processedSet = new Set<string>();
  let failedList: string[] = [];
  
  if (!forceRefresh) {
    const { processed, failed } = loadProgress();
    processedSet = new Set(processed);
    failedList = [...failed];
    
    if (processed.length > 0) {
      console.log(`📋 Found previous progress: ${processed.length} already processed`);
      console.log('⚠️  To start fresh, delete sync-progress.json\n');
    }
  } else {
    console.log('🆕 Starting fresh sync (ignoring previous progress)\n');
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
  }
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected\n');
    
    // Step 1: Fetch complete ETF list from EODHD
    console.log('📋 Fetching ETF list from EODHD...');
    
    const listResponse = await axios.get(
      `https://eodhd.com/api/exchange-symbol-list/US?api_token=${EODHD_API_TOKEN}&type=ETF&fmt=json`,
      { timeout: 30000 }
    );
    
    const etfList = listResponse.data;
    console.log(`✅ Found ${etfList.length} US ETFs to sync\n`);
    console.log(`📊 Already processed: ${processedSet.size}`);
    console.log(`📊 Remaining: ${etfList.length - processedSet.size}\n`);
    
    // Step 2: Sync each ETF
    for (let i = 0; i < etfList.length; i++) {
      const etfData = etfList[i];
      const ticker = etfData.Code;
      
      if (!ticker) continue;
      
      // Skip if already processed (unless force refresh)
      if (!forceRefresh && processedSet.has(ticker)) {
        skippedCount++;
        continue;
      }
      
      const progress = `[${i + 1}/${etfList.length}]`;
      const percentage = ((i + 1) / etfList.length * 100).toFixed(1);
      
      try {
        process.stdout.write(`${progress} (${percentage}%) ${ticker}...`);
        
        // Fetch fundamentals with correct field mappings
        const response = await axios.get(
          `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${EODHD_API_TOKEN}&fmt=json`,
          { timeout: 15000 }
        );
        
        const data = response.data;
        
        // Validate we got actual data
        if (!data || !data.General) {
          console.log(` ⚠️  No data`);
          errorCount++;
          failedList.push(ticker);
          processedSet.add(ticker);
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }
        
        // Extract data with CORRECT field names from actual EODHD API
        const aum = safeParseFloat(data.ETF_Data?.TotalAssets);
        const netExpenseRatio = safeParseFloat(data.ETF_Data?.NetExpenseRatio);
        const inceptionDate = data.ETF_Data?.Inception_Date ? new Date(data.ETF_Data.Inception_Date) : null;
        
        // Complex asset allocation extraction
        const stockUS = safeParseFloat(data.ETF_Data?.Asset_Allocation?.['Stock US']?.['Net_Assets_%']);
        const stockNonUS = safeParseFloat(data.ETF_Data?.Asset_Allocation?.['Stock non-US']?.['Net_Assets_%']);
        const equityAllocation = stockUS || stockNonUS || null;
        const bondAllocation = safeParseFloat(data.ETF_Data?.Asset_Allocation?.Bond?.['Net_Assets_%']);
        const cashAllocation = safeParseFloat(data.ETF_Data?.Asset_Allocation?.Cash?.['Net_Assets_%']);
        
        // Valuations
        const priceToBook = safeParseFloat(data.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Book']);
        const priceToSales = safeParseFloat(data.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Sales']);
        
        const etfRecord = {
          ticker,
          name: data.General?.Name || etfData.Name || ticker,
          assetClass: data.General?.Category || 'Unknown',
          exchange: data.General?.Exchange || 'US',
          country: data.General?.CountryISO || 'US',
          currency: data.General?.CurrencyCode || 'USD',
          
          // Financial metrics
          aum,
          netExpenseRatio,
          
          // Descriptive fields
          strategyType: data.General?.Type || null,
          summary: data.General?.Description || null,
          investmentPhilosophy: null,
          benchmarkIndex: data.ETF_Data?.Index_Name || null,
          
          // Dates
          inceptionDate,
          
          // Asset allocations
          equityAllocation,
          bondAllocation,
          cashAllocation,
          otherAllocation: safeParseFloat(data.ETF_Data?.Asset_Allocation?.Other?.['Net_Assets_%']),
          
          // Market cap allocations
          megaCapAllocation: safeParseFloat(data.ETF_Data?.Market_Capitalisation?.Mega),
          bigCapAllocation: safeParseFloat(data.ETF_Data?.Market_Capitalisation?.Big),
          mediumCapAllocation: safeParseFloat(data.ETF_Data?.Market_Capitalisation?.Medium),
          smallCapAllocation: safeParseFloat(data.ETF_Data?.Market_Capitalisation?.Small),
          microCapAllocation: safeParseFloat(data.ETF_Data?.Market_Capitalisation?.Micro),
          
          // Valuation metrics
          priceToBook,
          priceToSales,
          priceToCashFlow: safeParseFloat(data.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio?.['Price/Cash Flow']),
          projectedEarningsGrowth: safeParseFloat(data.ETF_Data?.Valuations_Growth?.Growth_Rates_Portfolio?.['Long-Term Projected Earnings Growth']),
          
          // Portfolio characteristics
          turnover: safeParseFloat(data.ETF_Data?.AnnualHoldingsTurnover),
        };
        
        // Track field population
        if (aum !== null) fieldsPopulated.aum++;
        if (netExpenseRatio !== null) fieldsPopulated.netExpenseRatio++;
        if (inceptionDate !== null) fieldsPopulated.inceptionDate++;
        if (equityAllocation !== null || bondAllocation !== null) fieldsPopulated.assetAllocation++;
        if (priceToBook !== null || priceToSales !== null) fieldsPopulated.valuations++;
        
        // Upsert to database
        const result = await prisma.etf.upsert({
          where: { ticker },
          update: {
            name: etfRecord.name,
            assetClass: etfRecord.assetClass,
            aum: etfRecord.aum,
            netExpenseRatio: etfRecord.netExpenseRatio,
            strategyType: etfRecord.strategyType,
            summary: etfRecord.summary,
            investmentPhilosophy: etfRecord.investmentPhilosophy,
            benchmarkIndex: etfRecord.benchmarkIndex,
            inceptionDate: etfRecord.inceptionDate,
            equityAllocation: etfRecord.equityAllocation,
            bondAllocation: etfRecord.bondAllocation,
            cashAllocation: etfRecord.cashAllocation,
            otherAllocation: etfRecord.otherAllocation,
            megaCapAllocation: etfRecord.megaCapAllocation,
            bigCapAllocation: etfRecord.bigCapAllocation,
            mediumCapAllocation: etfRecord.mediumCapAllocation,
            smallCapAllocation: etfRecord.smallCapAllocation,
            microCapAllocation: etfRecord.microCapAllocation,
            priceToBook: etfRecord.priceToBook,
            priceToSales: etfRecord.priceToSales,
            priceToCashFlow: etfRecord.priceToCashFlow,
            projectedEarningsGrowth: etfRecord.projectedEarningsGrowth,
            turnover: etfRecord.turnover,
            updatedAt: new Date(),
          },
          create: etfRecord,
        });
        
        console.log(` ✓`);
        successCount++;
        updatedCount++;
        processedSet.add(ticker);
        
        // Save progress every 50 ETFs
        if ((successCount) % 50 === 0) {
          const stats = {
            success: successCount,
            errors: errorCount,
            skipped: skippedCount,
            fieldsPopulated
          };
          saveProgress(Array.from(processedSet), failedList, stats);
          
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const actualProcessed = successCount + errorCount;
          const rate = actualProcessed / (Date.now() - startTime) * 60000; // per minute
          const remaining = (etfList.length - processedSet.size) / rate;
          
          console.log(`\n📊 Progress Report:`);
          console.log(`   ✅ Success: ${successCount}`);
          console.log(`   ❌ Errors: ${errorCount}`);
          console.log(`   ⏭️  Skipped (already done): ${skippedCount}`);
          console.log(`   ⏱️  Elapsed: ${elapsed} min`);
          console.log(`   🔮 Estimated remaining: ${remaining.toFixed(0)} min`);
          console.log(`   📈 Data quality: AUM ${((fieldsPopulated.aum/successCount)*100).toFixed(0)}%, ExpRatio ${((fieldsPopulated.netExpenseRatio/successCount)*100).toFixed(0)}%`);
          console.log();
        }
        
        // Rate limiting: 20 requests per second = 50ms delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error: any) {
        console.log(` ✗ ${error.response?.status || error.message}`);
        errorCount++;
        failedList.push(ticker);
        processedSet.add(ticker);
        
        // If rate limited, wait longer
        if (error.response?.status === 429) {
          console.log('⏸️  Rate limited, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else if (error.response?.status === 401) {
          console.log('\n❌ AUTHENTICATION ERROR - API token invalid or expired');
          console.log('   Check your EODHD dashboard for correct token\n');
          throw new Error('Invalid API token');
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Final summary
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const finalCount = await prisma.etf.count();
    
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`🔄 Updated this run: ${updatedCount}`);
    console.log(`📈 Total processed: ${etfList.length}`);
    console.log(`💾 ETFs in database: ${finalCount}`);
    console.log(`⏱️  Time taken: ${totalTime} minutes`);
    console.log('='.repeat(80));
    
    // Data quality report
    console.log('\n📊 DATA QUALITY REPORT:');
    console.log(`   AUM populated: ${fieldsPopulated.aum}/${successCount} (${((fieldsPopulated.aum/successCount)*100).toFixed(1)}%)`);
    console.log(`   Expense Ratio: ${fieldsPopulated.netExpenseRatio}/${successCount} (${((fieldsPopulated.netExpenseRatio/successCount)*100).toFixed(1)}%)`);
    console.log(`   Inception Date: ${fieldsPopulated.inceptionDate}/${successCount} (${((fieldsPopulated.inceptionDate/successCount)*100).toFixed(1)}%)`);
    console.log(`   Asset Allocation: ${fieldsPopulated.assetAllocation}/${successCount} (${((fieldsPopulated.assetAllocation/successCount)*100).toFixed(1)}%)`);
    console.log(`   Valuations: ${fieldsPopulated.valuations}/${successCount} (${((fieldsPopulated.valuations/successCount)*100).toFixed(1)}%)`);
    
    // Clean up progress file on success
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('\n✅ Progress file cleaned up\n');
    }
    
    if (failedList.length > 0) {
      console.log(`\n⚠️  ${failedList.length} ETFs failed:`);
      console.log(failedList.slice(0, 20).join(', '));
      if (failedList.length > 20) {
        console.log(`... and ${failedList.length - 20} more`);
      }
      console.log();
    }
    
    console.log('🌐 Refresh your website to see all data!');
    console.log('   https://etf-intelligence-platform.vercel.app\n');
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    
    // Save progress before exit
    const stats = {
      success: successCount,
      errors: errorCount,
      skipped: skippedCount,
      fieldsPopulated
    };
    saveProgress(Array.from(processedSet), failedList, stats);
    console.log('\n💾 Progress saved. You can resume by running the script again.\n');
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle interruptions gracefully
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted! Saving progress...');
  await prisma.$disconnect();
  process.exit(0);
});

// Check for command line args
const forceRefresh = process.argv.includes('--force') || process.argv.includes('--fresh');

if (forceRefresh) {
  console.log('🆕 Force refresh mode - will re-sync all ETFs\n');
}

fullSync(forceRefresh);