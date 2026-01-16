# Setup Guide

This guide will walk you through setting up the Coast Metering project step by step.

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works fine)
- npm or yarn package manager

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click **"New Project"**
4. Fill in:
   - **Name**: Coast Metering (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
5. Click **"Create new project"**
6. Wait 2-3 minutes for the project to be ready

### 3. Set Up Database Schema

1. In your Supabase project dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents of `schema.sql`
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned" - this means the schema was created successfully!

### 4. Get Your Supabase Credentials

1. In your Supabase dashboard, click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** in the settings menu
3. You'll see three important values:

   **Project URL:**
   - Located under "Project URL"
   - Looks like: `https://xxxxxxxxxxxxx.supabase.co`
   - Copy this entire URL

   **anon public key:**
   - Located under "Project API keys" → "anon" → "public"
   - This is a long string starting with `eyJ...`
   - Click the eye icon to reveal it, then copy it

   **service_role key:**
   - Located under "Project API keys" → "service_role" → "secret"
   - ⚠️ **WARNING**: This key has admin privileges - keep it secret!
   - Click the eye icon to reveal it, then copy it

### 5. Create Environment Variables File

1. In the root directory of this project, create a file named `.env`:
   ```bash
   touch .env
   ```

2. Open the `.env` file in your editor and add your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwMTIzNDU2LCJleHAiOjE5NTU3ODk0NTZ9.your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDAxMjM0NTYsImV4cCI6MTk1NTc4OTQ1Nn0.your-service-role-key-here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Replace the placeholder values with your actual credentials from Step 4

   **Example:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDEyMzQ1NiwiZXhwIjoxOTU1Nzg5NDU2fQ.actual-key-here
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMTIzNDU2LCJleHAiOjE5NTU3ODk0NTZ9.actual-service-key-here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

### 6. Start the Development Server

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

You should see the Coast Metering home page!

## Troubleshooting

### "Invalid API key" error
- Double-check that you copied the entire key (they're very long)
- Make sure there are no extra spaces or line breaks
- Verify you're using the correct key (anon vs service_role)

### "Failed to fetch" error
- Check that your `NEXT_PUBLIC_SUPABASE_URL` is correct
- Make sure your Supabase project is active (not paused)
- Verify your internet connection

### Database connection issues
- Make sure you ran the `schema.sql` file in the SQL Editor
- Check that your database password is correct
- Verify your project is not paused in Supabase

### Environment variables not loading
- Make sure the `.env` file is in the root directory (same level as `package.json`)
- Restart your development server after creating/editing `.env`
- Check that variable names start with `NEXT_PUBLIC_` for client-side variables

## Security Notes

- ✅ The `.env` file is already in `.gitignore` - it won't be committed to git
- ⚠️ Never share your `SUPABASE_SERVICE_ROLE_KEY` publicly
- ⚠️ Never commit `.env` files to version control
- ✅ The `anon` key is safe to use in client-side code (it's public by design)

## Next Steps

Once everything is set up:
1. Visit `/admin` to see the admin dashboard
2. Visit `/tenant` to see the tenant portal
3. Start adding properties, units, and tenants through the Supabase dashboard or API
