-- ===========================================
-- Add Landlord role and property assignment
-- Run after add-admin-and-manager-id.sql and manager-scoped-rls (if used).
-- ===========================================

-- 1) Allow 'landlord' role in user_profiles
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'manager', 'tenant', 'landlord'));

-- 2) Add landlord_id to properties (which landlord can view this property)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS landlord_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON properties(landlord_id);

-- 3) Invite codes: allow role 'landlord'
ALTER TABLE invite_codes
  DROP CONSTRAINT IF EXISTS invite_codes_role_check;

ALTER TABLE invite_codes
  ADD CONSTRAINT invite_codes_role_check
  CHECK (role IN ('tenant', 'manager', 'landlord'));

-- 4) Trigger: include 'landlord' when creating profile from invite metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_role TEXT;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';
  IF meta_role IN ('tenant', 'manager', 'admin', 'landlord') THEN
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

-- ===========================================
-- Landlord read-only RLS (run after manager-scoped-rls if used)
-- Landlords can only SELECT properties where landlord_id = auth.uid() and related data.
-- ===========================================

CREATE OR REPLACE FUNCTION is_landlord()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'landlord'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Landlord read own assigned properties
CREATE POLICY "Landlord read own properties" ON properties
  FOR SELECT USING (is_landlord() AND landlord_id = auth.uid());

-- Landlord read units on their properties
CREATE POLICY "Landlord read units on own properties" ON units
  FOR SELECT USING (
    is_landlord() AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id AND p.landlord_id = auth.uid()
    )
  );

-- Landlord read tenants in their properties
CREATE POLICY "Landlord read tenants in own properties" ON tenants
  FOR SELECT USING (
    is_landlord() AND EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = tenants.unit_id AND p.landlord_id = auth.uid()
    )
  );

-- Landlord read meters in their properties
CREATE POLICY "Landlord read meters in own properties" ON meters
  FOR SELECT USING (
    is_landlord() AND EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = meters.unit_id AND p.landlord_id = auth.uid()
    )
  );

-- Landlord read meter_readings in their properties
CREATE POLICY "Landlord read meter_readings in own properties" ON meter_readings
  FOR SELECT USING (
    is_landlord() AND EXISTS (
      SELECT 1 FROM meters m
      JOIN units u ON u.id = m.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE m.id = meter_readings.meter_id AND p.landlord_id = auth.uid()
    )
  );
