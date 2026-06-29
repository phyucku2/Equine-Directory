-- Owner profile facets (specs/owner-profile-facets.md)
-- Additive only. Hand-authored to avoid dropping the raw-SQL trigram GIN indexes
-- (idx_business_name_trgm, idx_business_address_trgm) that prisma migrate dev
-- would otherwise try to DROP (they live in 20260625093803_add_fts_and_trgm_indexes
-- and are intentionally not represented in schema.prisma).

ALTER TABLE "Business"
  ADD COLUMN "disciplines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "boardTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "trainingTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "trainingDisciplines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lessonLevels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "securityFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "policies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "priceFrom" INTEGER,
  ADD COLUMN "spotsAvailable" INTEGER,
  ADD COLUMN "stallCount" INTEGER,
  ADD COLUMN "acreage" DOUBLE PRECISION,
  ADD COLUMN "pricing" JSONB,
  ADD COLUMN "programs" JSONB,
  ADD COLUMN "careDetails" JSONB,
  ADD COLUMN "ownerEditedFacets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Business_disciplines_idx" ON "Business" USING GIN ("disciplines");
CREATE INDEX "Business_boardTypes_idx" ON "Business" USING GIN ("boardTypes");
CREATE INDEX "Business_trainingTypes_idx" ON "Business" USING GIN ("trainingTypes");
CREATE INDEX "Business_securityFeatures_idx" ON "Business" USING GIN ("securityFeatures");
CREATE INDEX "Business_policies_idx" ON "Business" USING GIN ("policies");
CREATE INDEX "Business_amenities_idx" ON "Business" USING GIN ("amenities");
CREATE INDEX "Business_priceFrom_idx" ON "Business" ("priceFrom");
