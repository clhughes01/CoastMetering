-- ===========================================
-- Add admin role and property manager assignment
-- Run this after auth-schema.sql and schema.sql
-- ===========================================

-- 1) Allow 'admin' role in user_profiles
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'manager', 'tenant'));

-- 2) Add manager_id to properties (which manager is responsible for this property)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_manager_id ON properties(manager_id);

-- 3) RLS: allow admins to view all profiles and update (for role management)
DROP POLICY IF EXISTS "Managers can view all profiles" ON user_profiles;
CREATE POLICY "Managers or admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Managers can update any profile" ON user_profiles;
CREATE POLICY "Managers or admins can update any profile" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('manager', 'admin')
    )
  );

-- Optional: allow admins to read all properties (for admin dashboard)
-- If your app uses service role in API routes, this may not be needed for API access.
