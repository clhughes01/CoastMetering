-- ===========================================
-- BILLS AND PAYMENT RECORDS (with receipts)
-- Run after schema that has tenants/units/properties
--
-- Storage: Create a bucket named "payment-receipts" in Supabase Dashboard
-- (Storage -> New bucket -> payment-receipts). Optionally set it to public
-- if you want receipt links to work without signed URLs.
-- ===========================================

-- Bills: one row per tenant per period (total amount due for that period)
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_account ON bills(account_number);
CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(period_year, period_month);

-- Payment records: partial or full payments against a bill (cash, etc.), with optional receipt images
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_bill ON payment_records(bill_id);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- Policies: allow read/write for authenticated users (admin/manager); restrict in app if needed
CREATE POLICY "Allow authenticated read bills" ON bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert bills" ON bills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update bills" ON bills FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read payment_records" ON payment_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert payment_records" ON payment_records FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger for bills.updated_at
CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
