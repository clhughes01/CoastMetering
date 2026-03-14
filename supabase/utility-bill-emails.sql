-- ===========================================
-- UTILITY BILL EMAILS
-- Stores ingested Escondido/Invoice Cloud bill notification emails
-- so bills can be linked to the email (for later payment via same link).
-- Run after utility-provider-bills.sql.
-- ===========================================

CREATE TABLE IF NOT EXISTS utility_bill_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE,
  subject TEXT,
  from_address TEXT,
  to_address TEXT,
  received_at TIMESTAMPTZ,
  body_plain TEXT,
  body_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utility_bill_emails_message_id ON utility_bill_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_utility_bill_emails_received ON utility_bill_emails(received_at);

COMMENT ON TABLE utility_bill_emails IS 'Ingested bill notification emails (e.g. Escondido); bills reference this for payment link';

-- Link bills to the email they came from (and store invoice/pay URL for later payment)
ALTER TABLE utility_provider_bills
  ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES utility_bill_emails(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_url TEXT;

CREATE INDEX IF NOT EXISTS idx_utility_provider_bills_source_email ON utility_provider_bills(source_email_id);

COMMENT ON COLUMN utility_provider_bills.source_email_id IS 'Email this bill was ingested from (for payment workflow)';
COMMENT ON COLUMN utility_provider_bills.invoice_url IS 'Direct link to view/pay this invoice (from email)';

ALTER TABLE utility_bill_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all utility_bill_emails" ON utility_bill_emails FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read utility_bill_emails" ON utility_bill_emails FOR SELECT TO authenticated USING (true);
