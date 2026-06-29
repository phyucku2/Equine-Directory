-- Monetization tiers & entitlements (specs/monetization-tiers.md)
-- Additive only. Hand-authored so prisma migrate dev never tries to DROP the
-- raw-SQL trigram GIN indexes (idx_business_name_trgm, idx_business_address_trgm
-- from 20260625093803_add_fts_and_trgm_indexes) or the facet GIN indexes — those
-- are intentionally not represented in schema.prisma. Nothing here drops anything.

-- AlterEnum: add the three new owner tiers (keep FREE/PRO/PREMIUM). IF NOT EXISTS
-- keeps the migration idempotent. New values are not referenced by any statement
-- in this migration, so they are safe to add in the same transaction.
ALTER TYPE "SubTier" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "SubTier" ADD VALUE IF NOT EXISTS 'TEAM';
ALTER TYPE "SubTier" ADD VALUE IF NOT EXISTS 'EVENTS';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "trainerSeats" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BusinessImage" ADD COLUMN "isLogo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Trainer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "bio" TEXT,
    "photoUrl" TEXT,
    "disciplines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "email" VARCHAR(255),
    "phone" VARCHAR(32),
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "price" INTEGER,
    "registrationUrl" VARCHAR(512),
    "locationId" TEXT,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spotlight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "weeklyRateCents" INTEGER NOT NULL DEFAULT 2500,
    "status" TEXT NOT NULL DEFAULT 'active',
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spotlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trainer_businessId_slug_key" ON "Trainer"("businessId", "slug");

-- CreateIndex
CREATE INDEX "Trainer_businessId_idx" ON "Trainer"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_businessId_slug_key" ON "Event"("businessId", "slug");

-- CreateIndex
CREATE INDEX "Event_businessId_idx" ON "Event"("businessId");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "Spotlight_locationId_status_idx" ON "Spotlight"("locationId", "status");

-- CreateIndex
CREATE INDEX "Spotlight_businessId_idx" ON "Spotlight"("businessId");

-- AddForeignKey
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spotlight" ADD CONSTRAINT "Spotlight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spotlight" ADD CONSTRAINT "Spotlight_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
