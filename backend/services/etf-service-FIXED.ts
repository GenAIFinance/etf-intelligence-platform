// FIXED ETF Sync Service - Corrected EODHD API Field Names
// Replace: apps/api/src/services/etf.ts (lines 149-192)
// This extracts the 18 investment detail fields correctly

// ... (keep all code above line 149 the same) ...

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

      const turnover = safeParseFloat(etfData?.AnnualHoldingsTurnover);
      const aum = safeParseFloat(etfData?.TotalAssets);
      const inceptionDate = etfData?.Inception_Date 
        ? new Date(etfData.Inception_Date) 
        : null;

// ... (rest of the file stays the same - the upsert code starting at line 210) ...
