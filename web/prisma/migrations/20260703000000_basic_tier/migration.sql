-- Basic entry tier (Goal 6: subscriptions start at $9/yr).
-- Additive only, mirroring 20260629120000_monetization_tiers: the new enum value
-- is not referenced by any statement in this migration, so it is safe to add in
-- the same transaction. Nothing here drops anything.
ALTER TYPE "SubTier" ADD VALUE IF NOT EXISTS 'BASIC';
