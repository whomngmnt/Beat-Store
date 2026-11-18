-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BeatStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "LicenseCode" AS ENUM ('BASIC', 'PREMIUM', 'TRACKOUT', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('MP3', 'WAV', 'STEMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "bpm" INTEGER NOT NULL,
    "musicalKey" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "tags" TEXT[],
    "coverUrl" TEXT,
    "previewKey" TEXT,
    "mp3Key" TEXT,
    "wavKey" TEXT,
    "stemsKey" TEXT,
    "status" "BeatStatus" NOT NULL DEFAULT 'DRAFT',
    "plays" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedByOrderId" TEXT,
    "reservedUntil" TIMESTAMP(3),

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseTier" (
    "id" TEXT NOT NULL,
    "code" "LicenseCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultPriceCents" INTEGER NOT NULL,
    "includesMp3" BOOLEAN NOT NULL,
    "includesWav" BOOLEAN NOT NULL,
    "includesStems" BOOLEAN NOT NULL,
    "streamLimit" INTEGER,
    "videoLimit" INTEGER,
    "terms" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "LicenseTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatLicense" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "licenseTierId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BeatLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "couponId" TEXT,
    "downloadTokenHash" TEXT,
    "downloadTokenExpiresAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "licenseTierId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "beatTitleSnapshot" TEXT NOT NULL,
    "licenseNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Download" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "maxCount" INTEGER NOT NULL DEFAULT 5,
    "lastAt" TIMESTAMP(3),

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Beat_slug_key" ON "Beat"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseTier_code_key" ON "LicenseTier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BeatLicense_beatId_licenseTierId_key" ON "BeatLicense"("beatId", "licenseTierId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_downloadTokenHash_key" ON "Order"("downloadTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Download_orderItemId_fileType_key" ON "Download"("orderItemId", "fileType");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- AddForeignKey
ALTER TABLE "Beat" ADD CONSTRAINT "Beat_reservedByOrderId_fkey" FOREIGN KEY ("reservedByOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatLicense" ADD CONSTRAINT "BeatLicense_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatLicense" ADD CONSTRAINT "BeatLicense_licenseTierId_fkey" FOREIGN KEY ("licenseTierId") REFERENCES "LicenseTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_licenseTierId_fkey" FOREIGN KEY ("licenseTierId") REFERENCES "LicenseTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
