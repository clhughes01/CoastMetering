-- ===========================================
-- FIX TRIGGER TO ALLOW ADMIN/DASHBOARD ACCESS
-- ===========================================
-- This updates the trigger to allow role changes when using
-- Supabase Dashboard (service role/admin access)
-- Run this to fix the "only managers can change this" error

-- Function to prevent users from changing their own role
-- But allow admin/service role access (from Supabase Dashboard)
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If the role is being changed
    IF OLD.role != NEW.role THEN
        -- Allow if using service role (auth.uid() is NULL) - for admin/dashboard access
        -- This allows you to change roles from Supabase Dashboard
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
