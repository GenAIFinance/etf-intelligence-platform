-- CreateIndex
CREATE INDEX "Etf_country_idx" ON "Etf"("country");

-- CreateIndex
CREATE INDEX "Etf_aum_idx" ON "Etf"("aum");

-- CreateIndex
CREATE INDEX "Etf_inceptionDate_idx" ON "Etf"("inceptionDate");

-- CreateIndex
CREATE INDEX "EtfHolding_sector_idx" ON "EtfHolding"("sector");

-- CreateIndex
CREATE INDEX "EtfHolding_asOfDate_idx" ON "EtfHolding"("asOfDate");

-- CreateIndex
CREATE INDEX "EtfMetricSnapshot_asOfDate_idx" ON "EtfMetricSnapshot"("asOfDate");

-- CreateIndex
CREATE INDEX "EtfSectorWeight_sector_idx" ON "EtfSectorWeight"("sector");

-- CreateIndex
CREATE INDEX "PriceBar_date_idx" ON "PriceBar"("date");
