-- ===========================================
-- SIGNUP TOKENS FOR EMAIL CONFIRMATION FLOW
-- Run after invite-codes.sql
-- Allows role to be set from invite code when user confirms email via client signUp.
-- ===========================================

-- One-time tokens issued when API validates invite code. Client includes token in signUp metadata;
-- trigger uses it to set role and then deletes the row.
CREATE TABLE IF NOT EXISTS signup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tenant', 'manager')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_tokens_token ON signup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_signup_tokens_email ON signup_tokens(email);
CREATE INDEX IF NOT EXISTS idx_signup_tokens_expires_at ON signup_tokens(expires_at);

ALTER TABLE signup_tokens ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (API) and trigger (SECURITY DEFINER) use this table.

-- ===========================================
-- Trigger: prefer role from signup_tokens when present in metadata
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_role TEXT;
  signup_token TEXT;
  token_role TEXT;
BEGIN
  signup_token := NEW.raw_user_meta_data->>'signup_token';
  IF signup_token IS NOT NULL AND signup_token <> '' THEN
    SELECT role INTO token_role
    FROM public.signup_tokens
    WHERE token = signup_token AND email = NEW.email AND expires_at > NOW()
    LIMIT 1;
    IF token_role IS NOT NULL THEN
      DELETE FROM public.signup_tokens WHERE token = signup_token;
      INSERT INTO public.user_profiles (id, email, role, name)
      VALUES (
        NEW.id,
        NEW.email,
        token_role,
        COALESCE(NEW.raw_user_meta_data->>'name', '')
      );
      RETURN NEW;
    END IF;
  END IF;

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
