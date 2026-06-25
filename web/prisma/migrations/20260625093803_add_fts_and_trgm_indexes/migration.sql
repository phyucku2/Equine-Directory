-- Full-text search + fuzzy matching support for Business.
-- See specs/design-dossier.md §4 (post-migration raw SQL).

-- Trigram extension for fuzzy name dedup / autocomplete.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search index over name + description.
CREATE INDEX IF NOT EXISTS idx_business_fts ON "Business"
  USING GIN (to_tsvector('english', "name" || ' ' || COALESCE("description", '')));

-- Trigram index on name for fuzzy dedup / autocomplete.
CREATE INDEX IF NOT EXISTS idx_business_name_trgm ON "Business"
  USING GIN ("name" gin_trgm_ops);

-- Trigram index on address to assist coarse dedup across sources.
CREATE INDEX IF NOT EXISTS idx_business_address_trgm ON "Business"
  USING GIN ("address" gin_trgm_ops);