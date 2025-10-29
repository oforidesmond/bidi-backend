-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "dispenserId" INTEGER,
ADD COLUMN     "pumpId" INTEGER;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_dispenserId_fkey" FOREIGN KEY ("dispenserId") REFERENCES "Dispenser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "Pump"("id") ON DELETE SET NULL ON UPDATE CASCADE;
