# How to Change a User to Property Manager

To make a user access the property manager portal, you need to change their `role` from `'tenant'` to `'manager'` in the database.

## Method 1: Via Supabase Dashboard (Easiest)

1. Go to your **Supabase Dashboard**
2. Click on **Table Editor** in the left sidebar
3. Select the **`user_profiles`** table
4. Find the user you want to change (you can search by email)
5. Click on the row to edit it
6. Change the **`role`** field from `tenant` to `manager`
7. Click **Save** (or press Enter)

That's it! The user will now be routed to the manager portal when they sign in.

## Method 2: Via SQL Editor

1. Go to your **Supabase Dashboard**
2. Click on **SQL Editor** in the left sidebar
3. Click **New query**
4. Paste this SQL (replace `user@example.com` with the actual email):

```sql
UPDATE user_profiles 
SET role = 'manager' 
WHERE email = 'user@example.com';
```

5. Click **Run** (or press Cmd/Ctrl + Enter)

## Method 3: Change Multiple Users at Once

If you need to change multiple users to managers:

```sql
-- Change multiple users by email
UPDATE user_profiles 
SET role = 'manager' 
WHERE email IN (
    'user1@example.com',
    'user2@example.com',
    'user3@example.com'
);
```

## Verify the Change

After changing the role, you can verify it worked:

```sql
SELECT email, role, name 
FROM user_profiles 
WHERE email = 'user@example.com';
```

You should see `role = 'manager'`.

## What Happens Next?

- The user will need to **sign out and sign back in** for the change to take effect
- After signing in, they will be automatically routed to `/manager/dashboard` instead of `/tenant/tenant.new/dashboard`
- They will have access to all manager features (viewing all properties, customers, statements, etc.)

## Change Back to Tenant

If you need to change them back to a tenant:

```sql
UPDATE user_profiles 
SET role = 'tenant' 
WHERE email = 'user@example.com';
```

Or use the Table Editor and change `role` back to `tenant`.
