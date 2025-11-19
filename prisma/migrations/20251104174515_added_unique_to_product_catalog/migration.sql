/*
  Warnings:

  - A unique constraint covering the columns `[omcId,name]` on the table `ProductCatalog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_omcId_name_key" ON "ProductCatalog"("omcId", "name");
