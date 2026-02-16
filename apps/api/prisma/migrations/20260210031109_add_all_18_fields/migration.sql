-- AlterTable
ALTER TABLE "Etf" ADD COLUMN "netExpenseRatio" REAL;

-- CreateIndex
CREATE INDEX "Etf_netExpenseRatio_idx" ON "Etf"("netExpenseRatio");
