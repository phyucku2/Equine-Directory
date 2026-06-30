-- Crowdsourced "Not a Stable or Barn" reports (specs/post-launch-fixes.md §4).
-- Additive only. Hand-authored so prisma migrate dev never tries to DROP the
-- raw-SQL trigram GIN indexes (idx_business_name_trgm, idx_business_address_trgm)
-- or the facet GIN indexes that are intentionally not represented in
-- schema.prisma. Nothing here drops anything.

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reason" VARCHAR(64) NOT NULL DEFAULT 'not_a_stable',
    "detail" VARCHAR(512),
    "reporterIp" VARCHAR(64),
    "reporterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_businessId_status_idx" ON "Report"("businessId", "status");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
