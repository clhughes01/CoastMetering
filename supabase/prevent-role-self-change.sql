-- ===========================================
-- TRIGGER TO PREVENT USERS FROM CHANGING THEIR OWN ROLE
-- ===========================================
-- This trigger prevents users from changing their own role
-- Only managers can change roles (handled by RLS policy)

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
