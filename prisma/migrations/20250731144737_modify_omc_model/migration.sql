-- AlterTable
ALTER TABLE "Omc" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "products" JSONB;
