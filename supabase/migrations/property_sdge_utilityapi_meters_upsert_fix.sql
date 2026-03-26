-- Fix property_sdge_utilityapi_meters so Supabase upsert can use (property_id, utility_key, meter_uid).
-- Renamed-from-property_utilityapi_meters tables already had that triple unique; fresh installs had
-- only (property_id, meter_uid). Align everything and set utility_key for SDG&E.

ALTER TABLE property_sdge_utilityapi_meters
  ADD COLUMN IF NOT EXISTS utility_key TEXT NOT NULL DEFAULT 'sdge_electric';

-- Drop old unique constraints (not the primary key) so we can use one canonical triple unique.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'property_sdge_utilityapi_meters'
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE property_sdge_utilityapi_meters DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS property_sdge_utilityapi_meters_prop_util_meter_uid
  ON property_sdge_utilityapi_meters (property_id, utility_key, meter_uid);

COMMENT ON COLUMN property_sdge_utilityapi_meters.utility_key IS 'Always sdge_electric for this table; enables consistent upsert with property_utilityapi_meters rename path.';
