-- Website Builder — multi-tenant barn sites (specs/website-builder.md)
-- Additive only. Hand-authored so prisma migrate dev never tries to DROP the
-- raw-SQL trigram GIN indexes (idx_business_name_trgm, idx_business_address_trgm
-- from 20260625093803_add_fts_and_trgm_indexes) or the facet GIN indexes — those
-- are intentionally not represented in schema.prisma. Nothing here drops anything.

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('DRAFT', 'LIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "templateId" TEXT NOT NULL,
    "theme" JSONB NOT NULL,
    "pages" JSONB NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'DRAFT',
    "dnsManaged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_businessId_key" ON "Site"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_subdomain_key" ON "Site"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Site_customDomain_key" ON "Site"("customDomain");

-- CreateIndex
CREATE INDEX "Site_status_idx" ON "Site"("status");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
