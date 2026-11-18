-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reviewNote" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "refundNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
