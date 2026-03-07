-- ===========================================
-- UTILITY PROVIDER BILLS (master bills from utility, e.g. Escondido Water)
-- Run after schema (properties table exists).
-- These are the raw bills from the utility portal, before we split by unit.
-- ===========================================

-- Map which property uses which utility account (for matching fetched bills to properties)
CREATE TABLE IF NOT EXISTS property_utility_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  utility_key TEXT NOT NULL,
  account_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, utility_key)
);

CREATE INDEX IF NOT EXISTS idx_property_utility_accounts_property ON property_utility_accounts(property_id);
CREATE INDEX IF NOT EXISTS idx_property_utility_accounts_account ON property_utility_accounts(utility_key, account_number);

COMMENT ON TABLE property_utility_accounts IS 'Maps property to utility account number (e.g. Escondido account #) for automatic bill fetch';

-- Master bills from the utility (one row per billing period per property/account)
CREATE TABLE IF NOT EXISTS utility_provider_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  utility_key TEXT NOT NULL,
  account_number TEXT NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  amount_due DECIMAL(10, 2) NOT NULL,
  due_date DATE,
  external_id TEXT,
  pdf_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, utility_key, billing_period_start)
);

CREATE INDEX IF NOT EXISTS idx_utility_provider_bills_property ON utility_provider_bills(property_id);
CREATE INDEX IF NOT EXISTS idx_utility_provider_bills_period ON utility_provider_bills(utility_key, billing_period_start);
CREATE INDEX IF NOT EXISTS idx_utility_provider_bills_fetched ON utility_provider_bills(fetched_at);

COMMENT ON TABLE utility_provider_bills IS 'Raw bills from utility portal (e.g. Escondido Water), fetched automatically or uploaded; used for splitting to tenant bills';

ALTER TABLE property_utility_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_provider_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read property_utility_accounts" ON property_utility_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert property_utility_accounts" ON property_utility_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update property_utility_accounts" ON property_utility_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow service_role read property_utility_accounts" ON property_utility_accounts FOR SELECT TO service_role USING (true);

CREATE POLICY "Allow authenticated read utility_provider_bills" ON utility_provider_bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role all utility_provider_bills" ON utility_provider_bills FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_property_utility_accounts_updated_at
  BEFORE UPDATE ON property_utility_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_utility_provider_bills_updated_at
  BEFORE UPDATE ON utility_provider_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
