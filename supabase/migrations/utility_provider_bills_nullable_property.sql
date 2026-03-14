-- Allow utility_provider_bills to be created without a property (match later).
-- Run once: Supabase SQL Editor or supabase db push.
ALTER TABLE utility_provider_bills
  ALTER COLUMN property_id DROP NOT NULL;

COMMENT ON COLUMN utility_provider_bills.property_id IS 'Property this bill belongs to; NULL until matched (e.g. after more properties are added).';
