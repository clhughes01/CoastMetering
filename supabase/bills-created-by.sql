-- ===========================================
-- Tie bills to the user who entered them
-- Run after bills-and-payments.sql
-- ===========================================

-- Add created_by so we know which manager/admin entered the bill
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_created_by ON bills(created_by);

-- Optional: comment for clarity (no data backfill; existing rows stay created_by = NULL)
COMMENT ON COLUMN bills.created_by IS 'User (admin or manager) who created this bill';
