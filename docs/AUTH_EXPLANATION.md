# Understanding Supabase Authentication Tables

## Overview

Supabase uses a two-table system for authentication:

1. **`auth.users`** - System table managed by Supabase Auth (not visible in Table Editor)
2. **`user_profiles`** - Custom table we created to store additional user information

## The `auth.users` Table

- **Location**: This is a system table in the `auth` schema
- **Visibility**: Not visible in the Supabase Table Editor by default
- **Purpose**: Stores core authentication data (email, password hash, etc.)
- **Management**: Automatically managed by Supabase Auth

### How to View `auth.users`

You can view users in the `auth.users` table through:

1. **Supabase Dashboard → Authentication → Users**
   - This is the easiest way to see all authenticated users
   - Shows email, created date, last sign in, etc.

2. **SQL Editor** (if you need to query it):
   ```sql
   SELECT id, email, created_at, email_confirmed_at 
   FROM auth.users;
   ```

## The `user_profiles` Table

- **Location**: Public schema (visible in Table Editor)
- **Purpose**: Extends `auth.users` with additional information:
  - `role` (manager or tenant)
  - `name`
  - `phone`
  - `company_name` (for managers)
  - `account_number` (for tenants)
- **Relationship**: Linked to `auth.users` via `id` (foreign key)

## How It Works

### Sign Up Flow

1. User signs up → Supabase Auth creates entry in `auth.users`
2. Database trigger (`handle_new_user`) automatically creates entry in `user_profiles`
3. Role is automatically assigned based on email domain

### Sign In Flow

1. User signs in → Supabase Auth authenticates against `auth.users`
2. App fetches user profile from `user_profiles` to get role
3. User is routed to appropriate portal based on role

## Troubleshooting

### "I see data in `user_profiles` but not in `users`"

This is normal! The `users` table is `auth.users` and is not visible in the Table Editor. Check:
- **Authentication → Users** in the Supabase Dashboard
- Or run: `SELECT * FROM auth.users;` in SQL Editor

### "Profile creation error"

If you see errors about profile creation:
1. Check that the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. Check RLS policies allow inserts: The `auth-schema.sql` includes a policy for public inserts
3. The code will retry creating the profile if the trigger fails

### "User can't sign in after signup"

1. Check if email confirmation is required (Settings → Authentication)
2. For development, you can disable email confirmation
3. Check that the user exists in `auth.users` (Authentication → Users)
