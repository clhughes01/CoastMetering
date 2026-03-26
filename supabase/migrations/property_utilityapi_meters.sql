-- Map Coast properties to UtilityAPI meter UIDs (for automated bill fetching).
-- This enables fetching SDG&E electric bills (and other utilities later) via UtilityAPI.

CREATE TABLE IF NOT EXISTS property_utilityapi_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  utility_key TEXT NOT NULL,
  meter_uid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, utility_key, meter_uid)
);

CREATE INDEX IF NOT EXISTS idx_property_utilityapi_meters_property ON property_utilityapi_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_utilityapi_meters_utility ON property_utilityapi_meters(utility_key, meter_uid);

COMMENT ON TABLE property_utilityapi_meters IS 'Maps a property to one or more UtilityAPI meter UIDs for automated bill ingestion (e.g. SDG&E electric).';

ALTER TABLE property_utilityapi_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all property_utilityapi_meters" ON property_utilityapi_meters
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read property_utilityapi_meters" ON property_utilityapi_meters
  FOR SELECT TO authenticated USING (true);

