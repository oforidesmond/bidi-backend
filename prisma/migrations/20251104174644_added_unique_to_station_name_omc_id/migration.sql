/*
  Warnings:

  - A unique constraint covering the columns `[name,omcId]` on the table `Station` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Station_name_omcId_key" ON "Station"("name", "omcId");
