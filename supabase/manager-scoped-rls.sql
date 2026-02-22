-- ===========================================
-- Manager-scoped RLS: Property Managers see only their properties
-- and unassigned properties (and related units/tenants/meters).
-- Admins see everything. Run after add-admin-and-manager-id.sql.
-- ===========================================

-- Helper: current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: current user is manager (or admin)
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop permissive public policies if they exist
DROP POLICY IF EXISTS "Allow public read access to properties" ON properties;
DROP POLICY IF EXISTS "Allow public insert to properties" ON properties;
DROP POLICY IF EXISTS "Allow public update to properties" ON properties;

DROP POLICY IF EXISTS "Allow public read access to units" ON units;
DROP POLICY IF EXISTS "Allow public insert to units" ON units;

DROP POLICY IF EXISTS "Allow public read access to tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public insert to tenants" ON tenants;

DROP POLICY IF EXISTS "Allow public read access to meters" ON meters;
DROP POLICY IF EXISTS "Allow public insert to meters" ON meters;

DROP POLICY IF EXISTS "Allow public read access to meter_readings" ON meter_readings;
DROP POLICY IF EXISTS "Allow public insert to meter_readings" ON meter_readings;

-- Properties: admin sees all; manager sees manager_id = self or null
CREATE POLICY "Admin or own/unassigned properties" ON properties
  FOR ALL
  USING (
    is_admin()
    OR (is_manager_or_admin() AND (manager_id = auth.uid() OR manager_id IS NULL))
  )
  WITH CHECK (
    is_admin()
    OR (is_manager_or_admin() AND (manager_id = auth.uid() OR manager_id IS NULL))
  );

-- Units: admin sees all; manager sees units whose property is visible
CREATE POLICY "Admin or units of visible properties" ON units
  FOR ALL USING (
    is_admin()
    OR (is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = units.property_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    ))
  );
CREATE POLICY "Manager insert units on visible property" ON units
  FOR INSERT WITH CHECK (
    is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = property_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    )
  );

-- Tenants: admin sees all; manager sees tenants in visible properties
CREATE POLICY "Admin or tenants in visible properties" ON tenants
  FOR ALL USING (
    is_admin()
    OR (is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = tenants.unit_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    ))
  );
CREATE POLICY "Manager insert tenants in visible unit" ON tenants
  FOR INSERT WITH CHECK (
    is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = unit_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    )
  );

-- Meters: admin sees all; manager sees meters in visible properties
CREATE POLICY "Admin or meters in visible properties" ON meters
  FOR ALL USING (
    is_admin()
    OR (is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = meters.unit_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    ))
  );
CREATE POLICY "Manager insert meters in visible unit" ON meters
  FOR INSERT WITH CHECK (
    is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = unit_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    )
  );

-- Meter readings: admin sees all; manager sees readings for meters in visible properties
CREATE POLICY "Admin or meter_readings in visible properties" ON meter_readings
  FOR ALL USING (
    is_admin()
    OR (is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM meters m
        JOIN units u ON u.id = m.unit_id
        JOIN properties p ON p.id = u.property_id
        WHERE m.id = meter_readings.meter_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    ))
  );
CREATE POLICY "Manager insert meter_readings in visible meter" ON meter_readings
  FOR INSERT WITH CHECK (
    is_manager_or_admin() AND (
      EXISTS (
        SELECT 1 FROM meters m
        JOIN units u ON u.id = m.unit_id
        JOIN properties p ON p.id = u.property_id
        WHERE m.id = meter_id AND (p.manager_id = auth.uid() OR p.manager_id IS NULL)
      )
    )
  );
