/*
  Warnings:

  - You are about to drop the column `pumpNo` on the `Station` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nationalId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contact]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Station_pumpNo_key";

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Station" DROP COLUMN "pumpNo";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cardUrl" TEXT,
ADD COLUMN     "contact" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "nationalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_key" ON "User"("contact");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
