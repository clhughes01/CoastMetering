-- ===========================================
-- Attach bills to a property (for filtering)
-- Run after bills-created-by.sql and schema (properties table exists)
-- ===========================================

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_property_id ON bills(property_id);

COMMENT ON COLUMN bills.property_id IS 'Property this bill is for; used for admin/manager filtering';
