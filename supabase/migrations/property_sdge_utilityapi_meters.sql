-- SDG&E-specific mapping of properties to UtilityAPI meter UIDs.
-- We keep this SDG&E-named to avoid confusion once multiple providers are supported.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'property_utilityapi_meters'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'property_sdge_utilityapi_meters'
  ) THEN
    ALTER TABLE property_utilityapi_meters RENAME TO property_sdge_utilityapi_meters;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS property_sdge_utilityapi_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  meter_uid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, meter_uid)
);

CREATE INDEX IF NOT EXISTS idx_property_sdge_utilityapi_meters_property ON property_sdge_utilityapi_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_sdge_utilityapi_meters_meter ON property_sdge_utilityapi_meters(meter_uid);

COMMENT ON TABLE property_sdge_utilityapi_meters IS 'Maps a property to one or more UtilityAPI meter UIDs for SDG&E electric bill ingestion.';

ALTER TABLE property_sdge_utilityapi_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all property_sdge_utilityapi_meters" ON property_sdge_utilityapi_meters
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read property_sdge_utilityapi_meters" ON property_sdge_utilityapi_meters
  FOR SELECT TO authenticated USING (true);

