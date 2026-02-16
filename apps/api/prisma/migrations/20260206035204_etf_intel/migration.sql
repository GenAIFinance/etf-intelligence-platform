-- CreateTable
CREATE TABLE "Etf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "assetClass" TEXT,
    "strategyType" TEXT,
    "summary" TEXT,
    "turnover" REAL,
    "aum" REAL,
    "inceptionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EtfSectorWeight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "etfId" INTEGER NOT NULL,
    "sector" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    CONSTRAINT "EtfSectorWeight_etfId_fkey" FOREIGN KEY ("etfId") REFERENCES "Etf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EtfHolding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "etfId" INTEGER NOT NULL,
    "holdingTicker" TEXT NOT NULL,
    "holdingName" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "asOfDate" DATETIME NOT NULL,
    CONSTRAINT "EtfHolding_etfId_fkey" FOREIGN KEY ("etfId") REFERENCES "Etf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceBar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "adjustedClose" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "EtfMetricSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "etfId" INTEGER NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "trailingReturnsJson" TEXT NOT NULL,
    "volatility" REAL,
    "sharpe" REAL,
    "maxDrawdown" REAL,
    "beta" REAL,
    "rsi14" REAL,
    "ma20" REAL,
    "ma50" REAL,
    "ma200" REAL,
    "hi52w" REAL,
    "lo52w" REAL,
    "latestPrice" REAL,
    CONSTRAINT "EtfMetricSnapshot_etfId_fkey" FOREIGN KEY ("etfId") REFERENCES "Etf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "snippet" TEXT,
    "rawJson" TEXT
);

-- CreateTable
CREATE TABLE "NewsTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "newsItemId" INTEGER NOT NULL,
    "topicLabel" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL,
    "embeddingJson" TEXT,
    CONSTRAINT "NewsTopic_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsImpact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "newsItemId" INTEGER NOT NULL,
    "etfId" INTEGER NOT NULL,
    "impactScore" REAL NOT NULL,
    "rationale" TEXT NOT NULL,
    "matchedHoldingsJson" TEXT NOT NULL,
    "matchedThemesJson" TEXT NOT NULL,
    CONSTRAINT "NewsImpact_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NewsImpact_etfId_fkey" FOREIGN KEY ("etfId") REFERENCES "Etf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HoldingClassification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "etfId" INTEGER NOT NULL,
    "holdingTicker" TEXT NOT NULL,
    "holdingName" TEXT NOT NULL,
    "themesJson" TEXT NOT NULL,
    "classifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HoldingClassification_etfId_fkey" FOREIGN KEY ("etfId") REFERENCES "Etf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttlSeconds" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Etf_ticker_key" ON "Etf"("ticker");

-- CreateIndex
CREATE INDEX "Etf_ticker_idx" ON "Etf"("ticker");

-- CreateIndex
CREATE INDEX "Etf_assetClass_idx" ON "Etf"("assetClass");

-- CreateIndex
CREATE INDEX "Etf_strategyType_idx" ON "Etf"("strategyType");

-- CreateIndex
CREATE INDEX "EtfSectorWeight_etfId_idx" ON "EtfSectorWeight"("etfId");

-- CreateIndex
CREATE UNIQUE INDEX "EtfSectorWeight_etfId_sector_asOfDate_key" ON "EtfSectorWeight"("etfId", "sector", "asOfDate");

-- CreateIndex
CREATE INDEX "EtfHolding_etfId_idx" ON "EtfHolding"("etfId");

-- CreateIndex
CREATE INDEX "EtfHolding_holdingTicker_idx" ON "EtfHolding"("holdingTicker");

-- CreateIndex
CREATE UNIQUE INDEX "EtfHolding_etfId_holdingTicker_asOfDate_key" ON "EtfHolding"("etfId", "holdingTicker", "asOfDate");

-- CreateIndex
CREATE INDEX "PriceBar_symbol_idx" ON "PriceBar"("symbol");

-- CreateIndex
CREATE INDEX "PriceBar_symbol_date_idx" ON "PriceBar"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBar_symbol_date_key" ON "PriceBar"("symbol", "date");

-- CreateIndex
CREATE INDEX "EtfMetricSnapshot_etfId_idx" ON "EtfMetricSnapshot"("etfId");

-- CreateIndex
CREATE UNIQUE INDEX "EtfMetricSnapshot_etfId_asOfDate_key" ON "EtfMetricSnapshot"("etfId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_url_key" ON "NewsItem"("url");

-- CreateIndex
CREATE INDEX "NewsItem_publishedAt_idx" ON "NewsItem"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsItem_source_idx" ON "NewsItem"("source");

-- CreateIndex
CREATE INDEX "NewsTopic_newsItemId_idx" ON "NewsTopic"("newsItemId");

-- CreateIndex
CREATE INDEX "NewsTopic_topicLabel_idx" ON "NewsTopic"("topicLabel");

-- CreateIndex
CREATE INDEX "NewsImpact_newsItemId_idx" ON "NewsImpact"("newsItemId");

-- CreateIndex
CREATE INDEX "NewsImpact_etfId_idx" ON "NewsImpact"("etfId");

-- CreateIndex
CREATE INDEX "NewsImpact_impactScore_idx" ON "NewsImpact"("impactScore");

-- CreateIndex
CREATE UNIQUE INDEX "NewsImpact_newsItemId_etfId_key" ON "NewsImpact"("newsItemId", "etfId");

-- CreateIndex
CREATE INDEX "HoldingClassification_etfId_idx" ON "HoldingClassification"("etfId");

-- CreateIndex
CREATE INDEX "HoldingClassification_holdingTicker_idx" ON "HoldingClassification"("holdingTicker");

-- CreateIndex
CREATE UNIQUE INDEX "HoldingClassification_etfId_holdingTicker_key" ON "HoldingClassification"("etfId", "holdingTicker");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCache_key_key" ON "ApiCache"("key");

-- CreateIndex
CREATE INDEX "ApiCache_key_idx" ON "ApiCache"("key");

-- CreateIndex
CREATE INDEX "ApiCache_fetchedAt_idx" ON "ApiCache"("fetchedAt");
