-- Widen BusinessImage.url to TEXT so it can hold the place-photo proxy path
-- (Google Places photo references can be long).
--
-- NOTE: the trigram GIN indexes (idx_business_name_trgm, idx_business_address_trgm)
-- are created via raw SQL in 20260625093803_add_fts_and_trgm_indexes and are not
-- modeled in schema.prisma, so `prisma migrate dev` tried to DROP them here. We
-- intentionally keep them — they power the fuzzy `%` search.
ALTER TABLE "BusinessImage" ALTER COLUMN "url" SET DATA TYPE TEXT;
