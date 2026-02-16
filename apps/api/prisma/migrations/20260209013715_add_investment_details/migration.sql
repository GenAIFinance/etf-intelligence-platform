-- AlterTable
ALTER TABLE "Etf" ADD COLUMN "benchmarkIndex" TEXT;
ALTER TABLE "Etf" ADD COLUMN "bigCapAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "bondAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "cashAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "equityAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "investmentPhilosophy" TEXT;
ALTER TABLE "Etf" ADD COLUMN "mediumCapAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "megaCapAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "microCapAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "otherAllocation" REAL;
ALTER TABLE "Etf" ADD COLUMN "priceToBook" REAL;
ALTER TABLE "Etf" ADD COLUMN "priceToCashFlow" REAL;
ALTER TABLE "Etf" ADD COLUMN "priceToSales" REAL;
ALTER TABLE "Etf" ADD COLUMN "projectedEarningsGrowth" REAL;
ALTER TABLE "Etf" ADD COLUMN "smallCapAllocation" REAL;
