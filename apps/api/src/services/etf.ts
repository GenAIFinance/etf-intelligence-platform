import { prisma } from '../db';
import { eodhdService } from './eodhd';
import { CacheService } from './cache';
import { config } from '../config';
import {
  calculateTrailingReturns,
  calculateVolatility,
  calculateSharpe,
  calculateMaxDrawdown,
  calculateBeta,
  calculateRSI,
  calculateMA,
  calculate52WeekHighLow,
  calculateHHI,
  calculateTop10Weight,
} from './metrics';
import { classifyHolding, THEME_TAXONOMY, ThemeExposure } from '@etf-intelligence/shared';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine asset class from EODHD data
 * Priority: Asset_Allocation data > Category field
 */
function determineAssetClass(general: any, etfData: any): string | null {
  // Method 1: Use Asset Allocation if available (most accurate)
  if (etfData?.Asset_Allocation?.Stock?.Net_Assets_Percentage) {
    const stockPercentage = parseFloat(etfData.Asset_Allocation.Stock.Net_Assets_Percentage);
    if (stockPercentage > 50) return 'Equity';
    
    const bondPercentage = etfData?.Asset_Allocation?.Bond?.Net_Assets_Percentage 
      ? parseFloat(etfData.Asset_Allocation.Bond.Net_Assets_Percentage) 
      : 0;
    if (bondPercentage > 50) return 'Fixed Income';
    
    return 'Mixed Allocation';
  }

  // Method 2: Use Category field as fallback
  const category = (general.Category || '').toLowerCase();
  
  if (category.match(/equity|stock|growth|value|blend|large|mid|small|cap/i)) {
    return 'Equity';
  }
  if (category.match(/bond|fixed income|treasury|municipal|corporate debt/i)) {
    return 'Fixed Income';
  }
  if (category.match(/commodity|gold|silver|oil|energy|metal/i)) {
    return 'Commodity';
  }
  if (category.match(/real estate|reit/i)) {
    return 'Real Estate';
  }
  if (category.match(/currency|forex|volatility|vix|inverse|leveraged|short/i)) {
    return 'Alternative';
  }
  if (category.match(/allocation|balanced|target date|target risk|moderate/i)) {
    return 'Mixed Allocation';
  }
  
  return null;
}

/**
 * Extract benchmark index from ETF description
 * Looks for common benchmark patterns like "S&P 500", "NASDAQ-100", etc.
 */
function extractBenchmarkIndex(description: string | null): string | null {
  if (!description) return null;
  
  // Common benchmark patterns
  const patterns = [
    /S&P 500/i,
    /S&P MidCap 400/i,
    /S&P SmallCap 600/i,
    /NASDAQ[- ]?100/i,
    /Russell 2000/i,
    /Russell 1000/i,
    /Russell 3000/i,
    /MSCI World/i,
    /MSCI EAFE/i,
    /MSCI Emerging Markets/i,
    /Dow Jones Industrial Average/i,
    /DJIA/i,
    /Bloomberg [A-Z][A-Za-z0-9\s]+ Index/i,
    /FTSE [A-Z0-9\s]+ Index/i,
    /tracks? (?:the )?([A-Z][A-Za-z0-9&\s]+Index)/i,
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

/**
 * Safely parse float from EODHD API response
 * Handles null, undefined, empty strings, and invalid numbers
 */
function safeParseFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// ETF SERVICE CLASS
// ============================================================================

export class EtfService {
  /**
   * Sync ETF fundamental data from EODHD API to database
   * Includes all 18 investment detail fields (17 investment + 1 cost)
   */
  async syncEtf(ticker: string): Promise<boolean> {
    try {
      const fundamentals = await eodhdService.getEtfFundamentals(ticker);
      if (!fundamentals) {
        console.warn(`No fundamentals data available for ${ticker}`);
        return false;
      }

      const general = fundamentals.General;
      const etfData = fundamentals.ETF_Data;

      // ======================================================================
      // PREPARE ALL ETF FIELDS
      // ======================================================================

      // ======================================================================
      // PREPARE ALL ETF FIELDS
      // ======================================================================

      // Core fields
      const name = general.Name;
      const exchange = general.Exchange;
      const country = general.CountryName;
      const currency = general.CurrencyCode;
      const assetClass = determineAssetClass(general, etfData);
      const strategyType = general.Category || null;
      const summary = general.Description || null;

      // Cast etfData to any to handle incomplete EODHD types
      const etfDataAny = etfData as any;

      // ======================================================================
      // INVESTMENT DETAILS - FIXED FIELD NAMES
      // ======================================================================

      // Investment Philosophy & Benchmark
      const investmentPhilosophy = general.Description || etfData?.Fund_Summary || null;
      const benchmarkIndex = extractBenchmarkIndex(general.Description) || etfData?.Index_Name?.trim() || null;

      // ======================================================================
      // ASSET ALLOCATION - FIXED: Use "Net_Assets_%" not "Net_Assets_Percentage"
      // ======================================================================
      
      const equityAllocation = (() => {
        const stockUS = safeParseFloat(etfData?.Asset_Allocation?.['Stock US']?.['Net_Assets_%']);
        const stockNonUS = safeParseFloat(etfData?.Asset_Allocation?.['Stock non-US']?.['Net_Assets_%']);
        if (stockUS !== null && stockNonUS !== null) {
          return stockUS + stockNonUS;
        }
        if (stockUS !== null) return stockUS;
        if (stockNonUS !== null) return stockNonUS;
        return null;
      })();

      const bondAllocation = safeParseFloat(
        etfData?.Asset_Allocation?.Bond?.['Net_Assets_%']
      );

      const cashAllocation = safeParseFloat(
        etfData?.Asset_Allocation?.Cash?.['Net_Assets_%']
      );

      const otherAllocation = safeParseFloat(
        etfData?.Asset_Allocation?.Other?.['Net_Assets_%']
      );

      // ======================================================================
      // MARKET CAP BREAKDOWN - FIXED: Use "Mega" not "Mega_%"
      // ======================================================================
      
      const megaCapAllocation = safeParseFloat(
        etfData?.Market_Capitalisation?.Mega
      );

      const bigCapAllocation = safeParseFloat(
        etfData?.Market_Capitalisation?.Big
      );

      const mediumCapAllocation = safeParseFloat(
        etfData?.Market_Capitalisation?.Medium
      );

      const smallCapAllocation = safeParseFloat(
        etfData?.Market_Capitalisation?.Small
      );

      const microCapAllocation = safeParseFloat(
        etfData?.Market_Capitalisation?.Micro
      );

      // ======================================================================
      // VALUATIONS & GROWTH - FIXED: Use "Price/Book" not "Price_to_Book"
      // ======================================================================
      
      const valuationsPortfolio = etfData?.Valuations_Growth?.Valuations_Rates_Portfolio;
      
      const priceToBook = safeParseFloat(
        valuationsPortfolio?.['Price/Book']
      );

      const priceToSales = safeParseFloat(
        valuationsPortfolio?.['Price/Sales']
      );

      const priceToCashFlow = safeParseFloat(
        valuationsPortfolio?.['Price/Cash Flow']
      );

      const growthPortfolio = etfData?.Valuations_Growth?.Growth_Rates_Portfolio;
      
      const projectedEarningsGrowth = safeParseFloat(
        growthPortfolio?.['Long-Term Projected Earnings Growth']
      );

      // ======================================================================
      // COST & CORE METRICS
      // ======================================================================
      
      const netExpenseRatio = safeParseFloat(
        etfData?.NetExpenseRatio
      );

      // Dividend yield and beta — available directly from EODHD
      const dividendYield = safeParseFloat(etfDataAny?.Yield);
      const betaVsMarket = safeParseFloat((fundamentals as any)?.Technicals?.Beta);

      const turnover = safeParseFloat(etfData?.AnnualHoldingsTurnover);
      const aum = safeParseFloat(etfData?.TotalAssets);
      const inceptionDate = etfData?.Inception_Date 
        ? new Date(etfData.Inception_Date) 
        : null;
        
      // ======================================================================
      // UPSERT ETF RECORD
      // ======================================================================

      const etf = await prisma.etf.upsert({
        where: { ticker },
        create: {
          // Core identification
          ticker,
          name,
          exchange,
          country,
          currency,
          assetClass,
          strategyType,
          summary,
          
          // Investment details
          investmentPhilosophy,
          benchmarkIndex,
          
          // Asset allocation
          equityAllocation,
          bondAllocation,
          cashAllocation,
          otherAllocation,
          
          // Market cap breakdown
          megaCapAllocation,
          bigCapAllocation,
          mediumCapAllocation,
          smallCapAllocation,
          microCapAllocation,
          
          // Valuations & growth
          priceToBook,
          priceToSales,
          priceToCashFlow,
          projectedEarningsGrowth,
          
          // Cost metrics
          netExpenseRatio,
          
          // Core metrics
          turnover,
          aum,
          inceptionDate,

          // Performance & risk
          dividendYield,
          betaVsMarket,
        },
        update: {
          // Update core fields
          name,
          assetClass,
          strategyType,
          summary,
          
          // Update investment details
          investmentPhilosophy,
          benchmarkIndex,
          
          // Update asset allocation
          equityAllocation,
          bondAllocation,
          cashAllocation,
          otherAllocation,
          
          // Update market cap breakdown
          megaCapAllocation,
          bigCapAllocation,
          mediumCapAllocation,
          smallCapAllocation,
          microCapAllocation,
          
          // Update valuations & growth
          priceToBook,
          priceToSales,
          priceToCashFlow,
          projectedEarningsGrowth,
          
          // Update cost metrics
          netExpenseRatio,
          
          // Update core metrics
          turnover,
          aum,
          updatedAt: new Date(),

          // Update performance & risk
          dividendYield,
          betaVsMarket,
        },
      });

      console.log(`✅ Synced ETF: ${ticker} (${name})`);

      // ======================================================================
      // SYNC SECTOR WEIGHTS
      // ======================================================================

      if (etfData?.Sector_Weights) {
        const asOfDate = new Date();
        asOfDate.setHours(0, 0, 0, 0); // Normalize to midnight

        for (const [sector, data] of Object.entries(etfData.Sector_Weights)) {
          // EODHD uses 'Equity_%' not 'Equity_Percentage'
          const equityPercent = (data as any)['Equity_%'] || (data as any).Equity_Percentage || '0';
          const weight = safeParseFloat(equityPercent);
          
          if (weight && weight > 0) {
            await prisma.etfSectorWeight.upsert({
              where: {
                etfId_sector_asOfDate: { etfId: etf.id, sector, asOfDate },
              },
              create: { 
                etfId: etf.id, 
                sector, 
                weight: weight / 100, // Convert to decimal
                asOfDate 
              },
              update: { 
                weight: weight / 100 
              },
            });
          }
        }
        console.log(`  ↳ Synced ${Object.keys(etfData.Sector_Weights).length} sector weights`);
      }

      // ======================================================================
      // SYNC HOLDINGS
      // ======================================================================

      if (etfData?.Holdings) {
        const asOfDate = new Date();
        asOfDate.setHours(0, 0, 0, 0);
        
        let holdingsCount = 0;
        let classificationsCount = 0;

        for (const [_, holding] of Object.entries(etfData.Holdings)) {
          const h = holding as any;
          
          // EODHD uses 'Assets_%' not 'Assets_Percentage'
          const assetsPercent = safeParseFloat(h['Assets_%'] || h.Assets_Percentage);
          
          if (h.Code && assetsPercent && assetsPercent > 0) {
            // Upsert holding
            await prisma.etfHolding.upsert({
              where: {
                etfId_holdingTicker_asOfDate: {
                  etfId: etf.id,
                  holdingTicker: h.Code,
                  asOfDate,
                },
              },
              create: {
                etfId: etf.id,
                holdingTicker: h.Code,
                holdingName: h.Name || h.Code,
                weight: assetsPercent / 100, // Convert to decimal
                sector: h.Sector || null,
                industry: h.Industry || null,
                asOfDate,
              },
              update: {
                holdingName: h.Name || h.Code,
                weight: assetsPercent / 100,
                sector: h.Sector || null,
                industry: h.Industry || null,
              },
            });
            holdingsCount++;

            // Classify holding into themes
            const themes = classifyHolding(
              h.Name || '', 
              h.Code, 
              h.Sector, 
              h.Industry
            );
            
            if (themes.length > 0) {
              await prisma.holdingClassification.upsert({
                where: {
                  etfId_holdingTicker: { etfId: etf.id, holdingTicker: h.Code },
                },
                create: {
                  etfId: etf.id,
                  holdingTicker: h.Code,
                  holdingName: h.Name || h.Code,
                  themesJson: JSON.stringify(themes),
                },
                update: {
                  themesJson: JSON.stringify(themes),
                  classifiedAt: new Date(),
                },
              });
              classificationsCount++;
            }
          }
        }
        
        console.log(`  ↳ Synced ${holdingsCount} holdings, classified ${classificationsCount} into themes`);
      }

      return true;
      
    } catch (error) {
      console.error(`❌ Failed to sync ETF ${ticker}:`, error);
      return false;
    }
  }

  /**
   * Sync historical price data from EODHD API
   * Fetches last 5 years of daily OHLCV data
   */
  async syncPrices(ticker: string): Promise<boolean> {
    try {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const today = new Date();

      const prices = await eodhdService.getHistoricalPrices(
        ticker,
        fiveYearsAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );

      if (!prices || prices.length === 0) {
        console.warn(`No price data available for ${ticker}`);
        return false;
      }

      let pricesCount = 0;
      for (const price of prices) {
        const date = new Date(price.date);
        date.setHours(0, 0, 0, 0); // Normalize to midnight

        await prisma.priceBar.upsert({
          where: {
            symbol_date: { symbol: ticker, date },
          },
          create: {
            symbol: ticker,
            date,
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume,
            adjustedClose: price.adjusted_close,
          },
          update: {
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume,
            adjustedClose: price.adjusted_close,
          },
        });
        pricesCount++;
      }

      console.log(`✅ Synced ${pricesCount} price bars for ${ticker}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to sync prices for ${ticker}:`, error);
      return false;
    }
  }

  /**
   * Calculate and store performance metrics
   * Includes trailing returns, volatility, Sharpe, beta, technical indicators
   */
  async calculateMetrics(ticker: string): Promise<boolean> {
    try {
      const etf = await prisma.etf.findUnique({ where: { ticker } });
      if (!etf) {
        console.warn(`ETF ${ticker} not found in database`);
        return false;
      }

      // Get price history
      const prices = await prisma.priceBar.findMany({
        where: { symbol: ticker },
        orderBy: { date: 'desc' },
      });

      if (prices.length < 20) {
        console.warn(`Insufficient price data for ${ticker} (${prices.length} bars, need 20+)`);
        return false;
      }

      const pricePoints = prices.map((p) => ({
        date: p.date,
        close: p.close,
        adjustedClose: p.adjustedClose,
      }));

      // Get benchmark prices for beta calculation
      const benchmarkPrices = await prisma.priceBar.findMany({
        where: { symbol: config.benchmarkTicker },
        orderBy: { date: 'desc' },
      });

      const benchmarkPoints = benchmarkPrices.map((p) => ({
        date: p.date,
        close: p.close,
        adjustedClose: p.adjustedClose,
      }));

      // Calculate all metrics
      const trailingReturns = calculateTrailingReturns(pricePoints);
      const volatility = calculateVolatility(pricePoints);
      const sharpe = calculateSharpe(pricePoints);
      const maxDrawdown = calculateMaxDrawdown(pricePoints);
      const beta = calculateBeta(pricePoints, benchmarkPoints);
      const rsi14 = calculateRSI(pricePoints);
      const ma20 = calculateMA(pricePoints, 20);
      const ma50 = calculateMA(pricePoints, 50);
      const ma200 = calculateMA(pricePoints, 200);
      const { high: hi52w, low: lo52w } = calculate52WeekHighLow(pricePoints);
      const latestPrice = pricePoints[0]?.adjustedClose || null;

      const asOfDate = new Date();
      asOfDate.setHours(0, 0, 0, 0);

      // Upsert metrics snapshot
      await prisma.etfMetricSnapshot.upsert({
        where: {
          etfId_asOfDate: { etfId: etf.id, asOfDate },
        },
        create: {
          etfId: etf.id,
          asOfDate,
          trailingReturnsJson: JSON.stringify(trailingReturns),
          // Individual return fields for easy querying
          return1M: trailingReturns['1M'],
          return3M: trailingReturns['3M'],
          return6M: trailingReturns['6M'],
          return1Y: trailingReturns['1Y'],
          return3Y: trailingReturns['3Y'],
          return5Y: trailingReturns['5Y'],
          returnYTD: trailingReturns['YTD'],
          volatility,
          sharpe,
          maxDrawdown,
          beta,
          rsi14,
          ma20,
          ma50,
          ma200,
          hi52w,
          lo52w,
          latestPrice,
        },
        update: {
          trailingReturnsJson: JSON.stringify(trailingReturns),
          return1M: trailingReturns['1M'],
          return3M: trailingReturns['3M'],
          return6M: trailingReturns['6M'],
          return1Y: trailingReturns['1Y'],
          return3Y: trailingReturns['3Y'],
          return5Y: trailingReturns['5Y'],
          returnYTD: trailingReturns['YTD'],
          volatility,
          sharpe,
          maxDrawdown,
          beta,
          rsi14,
          ma20,
          ma50,
          ma200,
          hi52w,
          lo52w,
          latestPrice,
        },
      });

      console.log(`✅ Calculated metrics for ${ticker}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to calculate metrics for ${ticker}:`, error);
      return false;
    }
  }

  /**
   * Get theme exposures for an ETF
   * Returns breakdown of ETF exposure to each investment theme
   */
  async getThemeExposures(ticker: string): Promise<ThemeExposure[]> {
    const etf = await prisma.etf.findUnique({ where: { ticker } });
    if (!etf) return [];

    const classifications = await prisma.holdingClassification.findMany({
      where: { etfId: etf.id },
    });

    const holdings = await prisma.etfHolding.findMany({
      where: { etfId: etf.id },
      orderBy: { asOfDate: 'desc' },
    });

    // Build theme exposures
    const themeMap: Map<
      string, 
      { 
        exposure: number; 
        holdings: { 
          ticker: string; 
          name: string; 
          weight: number; 
          confidence: number 
        }[] 
      }
    > = new Map();

    // Initialize all themes
    for (const theme of THEME_TAXONOMY) {
      themeMap.set(theme.id, { exposure: 0, holdings: [] });
    }

    // Process classifications
    for (const classification of classifications) {
      const themes = JSON.parse(classification.themesJson) as { 
        themeId: string; 
        confidence: number 
      }[];
      
      const holding = holdings.find((h) => h.holdingTicker === classification.holdingTicker);
      const weight = holding?.weight || 0;

      for (const { themeId, confidence } of themes) {
        const themeData = themeMap.get(themeId);
        if (themeData) {
          themeData.exposure += weight * confidence;
          themeData.holdings.push({
            ticker: classification.holdingTicker,
            name: classification.holdingName,
            weight,
            confidence,
          });
        }
      }
    }

    // Convert to array and sort
    const exposures: ThemeExposure[] = [];
    for (const [themeId, data] of themeMap.entries()) {
      const theme = THEME_TAXONOMY.find((t) => t.id === themeId);
      if (theme && data.exposure > 0) {
        exposures.push({
          themeId,
          themeName: theme.name,
          exposure: data.exposure,
          holdings: data.holdings.sort((a, b) => b.weight - a.weight).slice(0, 20),
        });
      }
    }

    return exposures.sort((a, b) => b.exposure - a.exposure);
  }

  /**
   * Get concentration metrics for an ETF
   * Returns top 10 weight, HHI, and total holdings count
   */
  async getConcentrationMetrics(ticker: string): Promise<{
    top10Weight: number;
    hhi: number;
    totalHoldings: number;
  } | null> {
    const etf = await prisma.etf.findUnique({ where: { ticker } });
    if (!etf) return null;

    const holdings = await prisma.etfHolding.findMany({
      where: { etfId: etf.id },
      orderBy: { weight: 'desc' },
    });

    if (holdings.length === 0) return null;

    const weights = holdings.map((h) => h.weight);

    return {
      top10Weight: calculateTop10Weight(weights),
      hhi: calculateHHI(weights),
      totalHoldings: holdings.length,
    };
  }

  /**
   * Get all ETFs from database
   * Useful for batch processing
   */
  async getAllEtfs(): Promise<Array<{ ticker: string; name: string }>> {
    const etfs = await prisma.etf.findMany({
      select: { ticker: true, name: true },
      orderBy: { ticker: 'asc' },
    });
    return etfs;
  }

  /**
   * Full sync workflow for a single ETF
   * Syncs fundamentals, prices, and calculates metrics
   */
  async fullSync(ticker: string): Promise<boolean> {
    console.log(`\n🔄 Starting full sync for ${ticker}...`);
    
    const fundamentalsSuccess = await this.syncEtf(ticker);
    if (!fundamentalsSuccess) {
      console.error(`❌ Full sync failed for ${ticker}: Could not sync fundamentals`);
      return false;
    }

    const pricesSuccess = await this.syncPrices(ticker);
    if (!pricesSuccess) {
      console.warn(`⚠️  Warning: Could not sync prices for ${ticker}`);
    }

    const metricsSuccess = await this.calculateMetrics(ticker);
    if (!metricsSuccess) {
      console.warn(`⚠️  Warning: Could not calculate metrics for ${ticker}`);
    }

    console.log(`✅ Full sync complete for ${ticker}\n`);
    return true;
  }
}

export const etfService = new EtfService();
