-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "handle" TEXT,
ADD COLUMN     "platform" TEXT NOT NULL DEFAULT 'whatsapp';
