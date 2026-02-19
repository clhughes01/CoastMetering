-- ===========================================
-- INVITE CODES FOR SIGN-UP
-- Run after auth-schema and add-admin-and-manager-id
-- ===========================================

-- Table: one-time codes that determine sign-up role. 24h expiry.
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('tenant', 'manager')),
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON invite_codes(expires_at);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE policies: only service role (API) can access.
-- This prevents clients from listing or creating codes directly.

-- ===========================================
-- Trigger: use role from user_metadata when creating profile (for code-based signup)
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_role TEXT;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';
  IF meta_role IN ('tenant', 'manager', 'admin') THEN
    INSERT INTO public.user_profiles (id, email, role, name)
    VALUES (
      NEW.id,
      NEW.email,
      meta_role,
      COALESCE(NEW.raw_user_meta_data->>'name', '')
    );
  ELSE
    INSERT INTO public.user_profiles (id, email, role, name)
    VALUES (
      NEW.id,
      NEW.email,
      CASE 
        WHEN NEW.email LIKE '%@coastmetering.com' OR NEW.email LIKE '%@coastmgmt.%' THEN 'manager'
        ELSE 'tenant'
      END,
      COALESCE(NEW.raw_user_meta_data->>'name', '')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
