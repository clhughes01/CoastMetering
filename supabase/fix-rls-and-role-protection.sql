-- ===========================================
-- FIX RLS POLICIES AND ADD ROLE PROTECTION
-- ===========================================
-- Run this to fix the RLS policies and add protection against role changes
-- This combines the fixes from update-rls-policies.sql and prevent-role-self-change.sql

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can update any profile" ON user_profiles;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Managers can view all profiles (for admin purposes)
CREATE POLICY "Managers can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'manager'
        )
    );

-- Users can update their own profile
-- Note: Role changes are prevented by the trigger below
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Managers can update any profile (including role changes)
CREATE POLICY "Managers can update any profile" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'manager'
        )
    );

-- Function to prevent users from changing their own role
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If the role is being changed
    IF OLD.role != NEW.role THEN
        -- Allow if using service role (auth.uid() is NULL) - for admin/dashboard access
        IF auth.uid() IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Check if the current user is a manager
        IF NOT EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'manager'
        ) THEN
            -- If not a manager, prevent the role change
            RAISE EXCEPTION 'Only managers can change user roles. You cannot change your own role.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON user_profiles;

-- Create the trigger
CREATE TRIGGER prevent_role_change_trigger
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_self_change();
