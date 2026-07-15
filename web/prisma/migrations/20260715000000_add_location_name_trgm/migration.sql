-- Trigram index on Location.name.
--
-- The crawler's city resolver (crawler/equine_crawler/pipeline/geocode.py) falls
-- back to a fuzzy match: `... WHERE l.type = 'CITY' AND l.name %% :city`. The
-- pg_trgm `%` operator needs a GIN trigram index to be index-backed; without one
-- every ingested listing triggers a full sequential scan of "Location". Because
-- the crawl also creates new city rows as it runs, that table grows during a run,
-- making the national ingest O(n^2) and pathologically slow. This mirrors the
-- existing Business.name/address trigram indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_location_name_trgm ON "Location"
  USING GIN ("name" gin_trgm_ops);
