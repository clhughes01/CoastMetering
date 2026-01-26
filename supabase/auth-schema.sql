-- ===========================================
-- AUTHENTICATION & USER MANAGEMENT SCHEMA
-- ===========================================
-- This schema extends the existing database with user authentication
-- Run this after the main schema.sql

-- User profiles table (extends Supabase auth.users)
-- This table stores additional user information and role
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('manager', 'tenant')) DEFAULT 'tenant',
    name TEXT,
    phone TEXT,
    company_name TEXT, -- For managers
    account_number TEXT, -- For tenants (links to tenants table)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
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
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Prevent users from changing their own role
        (OLD.role = NEW.role)
    );

-- Managers can update any profile (including role changes)
CREATE POLICY "Managers can update any profile" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'manager'
        )
    );

-- Allow public insert (for signup)
CREATE POLICY "Allow public insert to user_profiles" ON user_profiles
    FOR INSERT WITH CHECK (true);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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

-- Trigger to prevent role self-change
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON user_profiles;
CREATE TRIGGER prevent_role_change_trigger
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_self_change();
