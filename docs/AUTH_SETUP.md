# Authentication Setup Guide

This guide explains how to set up authentication for the Coast Metering platform using Supabase Auth.

## Overview

The authentication system uses Supabase Auth for user management and automatically assigns roles based on email domain:
- **Manager**: Emails ending with `@coastmetering.com` or `@coastmgmt.*`
- **Tenant**: All other email addresses

## Database Setup

### Step 1: Run the Auth Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase/auth-schema.sql` from this project
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run**

This will create:
- `user_profiles` table - Stores user role and additional info
- Database trigger - Automatically creates profile when user signs up
- RLS policies - Controls access to user profiles

### Step 2: Verify Setup

After running the schema, verify the table was created:
```sql
SELECT * FROM user_profiles LIMIT 1;
```

## How It Works

### Sign Up Flow

1. User enters email, password, and optional name
2. System determines role based on email domain:
   - `@coastmetering.com` or `@coastmgmt.*` → `manager`
   - All others → `tenant`
3. Supabase Auth creates the user account
4. Database trigger automatically creates a profile in `user_profiles` table
5. User receives email verification (if enabled in Supabase)

### Sign In Flow

1. User enters email and password
2. Supabase Auth authenticates the user
3. System fetches user profile to get role
4. User is routed to appropriate portal:
   - `manager` → `/manager/dashboard`
   - `tenant` → `/tenant/dashboard`

## Email Domain Rules

The role assignment logic checks:
- If email contains `@coastmetering.com` → Manager
- If email contains `@coastmgmt.` → Manager
- Otherwise → Tenant

You can modify this logic in `lib/auth.ts` in the `signUp` function.

## Manual Role Assignment

If you need to manually change a user's role:

1. Go to Supabase Dashboard → Table Editor
2. Open `user_profiles` table
3. Find the user by email
4. Update the `role` field to `manager` or `tenant`

Or use SQL:
```sql
UPDATE user_profiles 
SET role = 'manager' 
WHERE email = 'user@example.com';
```

## Disabling Email Verification (Development)

For development, you may want to disable email verification:

1. Go to Supabase Dashboard → Authentication → Settings
2. Under "Email Auth", toggle off "Enable email confirmations"
3. Users can now sign in immediately after signup

## Security Notes

- Passwords are hashed and stored securely by Supabase
- User profiles are protected by Row Level Security (RLS)
- Users can only view/update their own profile
- Service role key should never be exposed to the client
