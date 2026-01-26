-- ===========================================
-- UPDATE RLS POLICIES FOR USER_PROFILES
-- ===========================================
-- Run this to update the RLS policies to allow managers to change user roles
-- This should be run after auth-schema.sql

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

-- Users can update their own profile (except role)
-- Note: We can't prevent role changes in RLS, so we'll rely on application logic
-- or create a trigger to prevent role changes by non-managers
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
