/*
  Warnings:

  - You are about to drop the column `products` on the `Omc` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Pump` table. All the data in the column will be lost.
  - You are about to drop the column `driverId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `mobileNumber` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the `Driver` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `productCatalogId` to the `Pump` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_userId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_stationId_fkey";

-- DropForeignKey
ALTER TABLE "Pump" DROP CONSTRAINT "Pump_productId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_driverId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_productId_fkey";

-- AlterTable
ALTER TABLE "Omc" DROP COLUMN "products";

-- AlterTable
ALTER TABLE "Pump" DROP COLUMN "productId",
ADD COLUMN     "productCatalogId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "driverId",
DROP COLUMN "mobileNumber",
DROP COLUMN "productId",
ADD COLUMN     "productCatalogId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "vehicleCount" INTEGER;

-- DropTable
DROP TABLE "Driver";

-- DropTable
DROP TABLE "Product";

-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "omcId" INTEGER NOT NULL,
    "defaultPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationProductPrice" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StationProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationProductPriceHistory" (
    "id" SERIAL NOT NULL,
    "priceId" INTEGER NOT NULL,
    "oldPrice" DOUBLE PRECISION NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" INTEGER,

    CONSTRAINT "StationProductPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StationProductPrice_catalogId_stationId_key" ON "StationProductPrice"("catalogId", "stationId");

-- AddForeignKey
ALTER TABLE "ProductCatalog" ADD CONSTRAINT "ProductCatalog_omcId_fkey" FOREIGN KEY ("omcId") REFERENCES "Omc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationProductPrice" ADD CONSTRAINT "StationProductPrice_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationProductPrice" ADD CONSTRAINT "StationProductPrice_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationProductPriceHistory" ADD CONSTRAINT "StationProductPriceHistory_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "StationProductPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationProductPriceHistory" ADD CONSTRAINT "StationProductPriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_productCatalogId_fkey" FOREIGN KEY ("productCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_productCatalogId_fkey" FOREIGN KEY ("productCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
