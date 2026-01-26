# Managing User Roles

## Overview

User roles determine which portal a user can access:
- **`manager`** → Manager/Admin portal (`/manager/dashboard`)
- **`tenant`** → Tenant portal (`/tenant/tenant.new/dashboard`)

## Changing User Roles

### Method 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. Open the **`user_profiles`** table
4. Find the user you want to update (search by email)
5. Click on the row to edit
6. Change the `role` field from `tenant` to `manager` (or vice versa)
7. Click **Save**

### Method 2: Via SQL Editor

Run this SQL query in the Supabase SQL Editor:

```sql
-- Change a user's role to manager
UPDATE user_profiles 
SET role = 'manager' 
WHERE email = 'user@example.com';

-- Change a user's role to tenant
UPDATE user_profiles 
SET role = 'tenant' 
WHERE email = 'user@example.com';
```

### Method 3: Via API (Future Enhancement)

A manager interface for changing user roles could be added to the admin portal in the future.

## Row Level Security (RLS) Policies

The database has the following RLS policies for `user_profiles`:

1. **Users can view their own profile** - Any authenticated user can see their own profile
2. **Managers can view all profiles** - Managers can see all user profiles
3. **Users can update their own profile** - Users can update their own info, but **cannot change their own role**
4. **Managers can update any profile** - Managers can update any user's profile, including role changes
5. **Public insert** - Anyone can create a profile during signup

## Automatic Role Assignment

By default, roles are assigned automatically based on email domain:
- `@coastmetering.com` or `@coastmgmt.*` → `manager`
- All other domains → `tenant`

However, you can manually override this by changing the role in the database as described above.

## Important Notes

- **Users cannot change their own role** - This prevents privilege escalation
- **Only managers can change roles** - This ensures proper access control
- **Role changes take effect immediately** - Users will need to sign out and sign back in to see the new portal
