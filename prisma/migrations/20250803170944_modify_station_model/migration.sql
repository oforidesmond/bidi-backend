/*
  Warnings:

  - You are about to drop the column `code` on the `Station` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Station` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pumpNo]` on the table `Station` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Station_code_key";

-- AlterTable
ALTER TABLE "Station" DROP COLUMN "code",
DROP COLUMN "location",
ADD COLUMN     "district" TEXT,
ADD COLUMN     "pumpNo" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "town" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Station_pumpNo_key" ON "Station"("pumpNo");
