-- Store provider invoice number (e.g. Escondido Invoice# 340244031417) for reference and dedupe.
ALTER TABLE utility_provider_bills
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

COMMENT ON COLUMN utility_provider_bills.invoice_number IS 'Provider invoice number from email (e.g. Escondido Invoice#); pdf_url filled later by Playwright step';
