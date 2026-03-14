# Autonomous Escondido Water Bill Fetch

This doc describes how to automatically pull current bills from the City of Escondido’s water bill portal (Invoice Cloud) so new bills are added to the database without manual uploads.

---

## Complete setup guide (migration already run)

You have already run **`utility-provider-bills.sql`**, so the tables exist. Do the following in order.

### Step 1: Create a CSV of properties and Escondido account numbers

One row per property that has an Escondido water account.

**Option A – By property ID**

1. In Supabase: **Table Editor** → **properties**. Copy the **id** (UUID) for each property.
2. Get each property's Escondido **account number** (from the bill or from [invoicecloud.com/escondidoca](https://www.invoicecloud.com/escondidoca) when logged in).
3. Create a CSV with header and one data row per property:

```csv
property_id,account_number
a1b2c3d4-e5f6-7890-abcd-ef1234567890,12345678
b2c3d4e5-f6a7-8901-bcde-f12345678901,87654321
```

**Option B – By address**

Use the same address/city/state/zip as in your **properties** table:

```csv
address,city,state,zip_code,account_number
123 Main St,Escondido,CA,92025,12345678
456 Oak Ave,Escondido,CA,92025,87654321
```

Save the file (e.g. `utility-accounts.csv`) in or next to your project.

### Step 2: Run the bulk import

1. Terminal in your **CoastMetering** project: `npm install`
2. Set Supabase env (use your real values):
   - **NEXT_PUBLIC_SUPABASE_URL** — Supabase → **Settings** → **API** → Project URL
   - **SUPABASE_SERVICE_ROLE_KEY** — Same page → **service_role** key (not anon)

   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."
   ```

3. Run: `npm run import-utility-accounts -- utility-accounts.csv`  
   Expect: **`Imported N property → account mapping(s) for escondido_water.`**
4. In Supabase **Table Editor** → **property_utility_accounts**, confirm rows with `utility_key = escondido_water`.

### Step 3: Add GitHub Actions secrets

1. GitHub → your **CoastMetering** repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** for each:

| Secret name | Value |
|-------------|--------|
| ESCONDIDO_LOGIN_EMAIL | Email for [invoicecloud.com/escondidoca](https://www.invoicecloud.com/escondidoca) |
| ESCONDIDO_LOGIN_PASSWORD | Password for that account |
| NEXT_PUBLIC_SUPABASE_URL | Supabase → Settings → API → Project URL |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Settings → API → **service_role** key (not anon) |
| ESCONDIDO_BRIGHTDATA_API_KEY | *(Optional)* Bright Data **Web Unlocker API** key (Bearer token). When set, the script uses the [Unlocker API](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction) (Direct API, no browser). Create an API at [Bright Data](https://brightdata.com/cp/web_access/new) → Web Access APIs → Create API → **Web Unlocker API**; your API key and zone name are in the zone Overview. See [Quickstart](https://docs.brightdata.com/scraping-automation/web-unlocker/quickstart) and [Send your first request](https://docs.brightdata.com/scraping-automation/web-unlocker/send-your-first-request). |
| ESCONDIDO_BRIGHTDATA_UNLOCKER_ZONE | *(Optional)* Your Unlocker API zone name (the name you gave when creating the API). Defaults to `web_unlocker1`. |
| ESCONDIDO_PROXY_SERVER | *(Optional)* Generic proxy URL for Playwright (e.g. `http://proxy:port`) if not using the Unlocker API. |
| ESCONDIDO_PROXY_USERNAME, ESCONDIDO_PROXY_PASSWORD | *(Optional)* Proxy auth if not embedded in ESCONDIDO_PROXY_SERVER. |

### Step 4: Push and run the workflow once

1. Commit and push the branch that has `.github/workflows/fetch-escondido-bills.yml` and the scripts.
2. GitHub → **Actions** → **Fetch Escondido bills** → **Run workflow** → **Run workflow**.
3. Open the run and check logs for **`Inserted N bill(s).`** (or fix any errors).
4. In Supabase **Table Editor** → **utility_provider_bills**, confirm new rows if the portal had bills.

### Step 5: Done

The workflow runs **daily at 8:00 AM UTC**. New bills are added to **utility_provider_bills** automatically. To change the schedule, edit `.github/workflows/fetch-escondido-bills.yml` → `schedule`.

**Adding properties in the UI:** When an admin or property manager **creates** or **edits** a property in the app, they can enter **Water Account # (Escondido)**. That value is saved to `property_utility_accounts`, so the next scheduled bill fetch will associate that account’s bills with the property. No extra CSV or SQL needed for new properties.

**Optional – test locally:** `npm install` then `npx playwright install chromium`, set the four env vars, then `npm run fetch-escondido-bills`.

---

## Step-by-step setup (do these in order)

### Step 1: Run the database migration

Create the tables that store utility accounts and fetched bills.

- Open your **Supabase** project → **SQL Editor**.
- Copy the full contents of **`supabase/utility-provider-bills.sql`** from this repo and paste into the editor.
- Click **Run**.  
  (If you use Supabase CLI and migrations, you can run `supabase db push` instead, after putting that SQL in your migrations folder.)

You should see tables **`property_utility_accounts`** and **`utility_provider_bills`** in the Table Editor.

---

### Step 2: Bulk map properties to Escondido accounts (one-time, no per-property SQL)

You can load **all** property → account mappings in one go using a CSV (or the API). No need to run a separate SQL insert for each property.

**Option A – CSV import script (recommended for hundreds of properties)**

1. Create a CSV file with one of these formats.

   **By property ID** (if you have UUIDs from Supabase):

   ```csv
   property_id,account_number
   a1b2c3d4-e5f6-7890-abcd-ef1234567890,12345678
   b2c3d4e5-f6a7-8901-bcde-f12345678901,87654321
   ```

   **By address** (script looks up the property for you):

   ```csv
   address,city,state,zip_code,account_number
   123 Main St,Escondido,CA,92025,12345678
   456 Oak Ave,Escondido,CA,92025,87654321
   ```

   Use the same address/city/state/zip as in your **properties** table so the script can match.

2. Set env (or use a `.env` that has Supabase keys):

   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

3. Run the import once:

   ```bash
   npm run import-utility-accounts -- path/to/your-file.csv
   ```

   You should see: `Imported N property → account mapping(s) for escondido_water.`

**Option B – API (admin-only)**

- POST to `/api/admin/property-utility-accounts/import` as an authenticated **admin**.
- Body: **JSON** `{ "rows": [ { "property_id": "uuid", "account_number": "12345" }, ... ] }`  
  or **CSV** with header row `property_id,account_number` and data rows.
- Content-Type: `application/json` or `text/csv`.

Useful if you want to wire this to an admin UI or another tool.

**Single-property fallback:** If you only have one or two properties, you can still run one SQL insert per property (see “1. Database setup” later in this doc). For many properties, use the bulk import above.

---

### Step 3: Add GitHub Actions secrets

The workflow file **`.github/workflows/fetch-escondido-bills.yml`** is already in the repo. You only need to add secrets so it can log in and write to Supabase.

1. On **GitHub**, open your **CoastMetering** repo.
2. Go to **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret** and add these four secrets (one at a time):

| Secret name | Value |
|-------------|--------|
| `ESCONDIDO_LOGIN_EMAIL` | The email you use to log in at [invoicecloud.com/escondidoca](https://www.invoicecloud.com/escondidoca). |
| `ESCONDIDO_LOGIN_PASSWORD` | The password for that account. |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`). Find it in Supabase → **Settings** → **API**. |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase **service_role** key (not the anon key). Same place: **Settings** → **API** → **Project API keys** → **service_role** (Reveal and copy). |

**Important:** Use the **service_role** key only in GitHub Secrets (or other server-side env). Never put it in frontend code or in a public repo.

---

### Step 4: Push the workflow and run it once

1. Commit and push the branch that contains **`.github/workflows/fetch-escondido-bills.yml`** (it’s already in the repo).
2. On GitHub go to **Actions** → **Fetch Escondido bills**.
3. Click **Run workflow** → **Run workflow** to trigger the job once.
4. Open the run and check the logs. You should see something like “Inserted N bill(s).” If you see errors (e.g. login failed or no table), fix the issue and run again.

---

### Step 5: Confirm it’s autonomous

- The workflow is scheduled to run **daily at 8:00 AM UTC** (see `cron: '0 8 * * *'` in the workflow).
- You can change the schedule by editing `.github/workflows/fetch-escondido-bills.yml` and the `schedule` section.
- After each run, new bills (when present on the portal) appear in **`utility_provider_bills`** in Supabase. No manual steps needed.

**Optional:** Run the script locally once to double-check login and scraping (before or after setting up Actions):

```bash
npm install
npx playwright install chromium
# Set the same four env vars in .env or your shell, then:
npm run fetch-escondido-bills
```

---

## Fully autonomous (no manual runs)

**Yes, this can be fully autonomous.** Once you complete the one-time setup below, the system will fetch new bills on a schedule with **no manual input**. No one needs to run the script or touch anything.

- **One-time setup**: Run the DB migration, add property→account mapping, add env vars/secrets, and enable one of the scheduling options (e.g. GitHub Actions).
- **After that**: The script runs automatically (e.g. daily). New bills appear in `utility_provider_bills` without any action from you.

**Easiest path**: Use **GitHub Actions** (Option A below). Add the workflow file, set the four secrets in your repo, and push. GitHub will run the fetcher every day at 8 AM UTC (or whatever schedule you set). You never run the script by hand.

---

## Overview

- **Portal**: [invoicecloud.com/escondidoca](https://www.invoicecloud.com/escondidoca) (login with email + password).
- **Flow**: A script logs in, scrapes the bill list, and upserts rows into `utility_provider_bills` (and uses `property_utility_accounts` to map accounts to properties).
- **Scheduling**: Playwright does not run inside Vercel serverless. You run the script on a cron worker (GitHub Actions, Railway, cron job, etc.) or call a webhook that runs the script.

## 1. Database setup

Run the migration so the new tables exist:

```bash
# If using Supabase CLI / migrations
supabase db push
# Or run the SQL file manually in Supabase SQL Editor:
# supabase/utility-provider-bills.sql
```

This creates:

- **`property_utility_accounts`** – Maps each property to its Escondido account number (`utility_key = 'escondido_water'`).
- **`utility_provider_bills`** – One row per billing period per property: amount, due date, period, optional PDF link, etc.

Add a row per property that has an Escondido account (or use **bulk import** below so you don’t run one SQL per property):

```sql
INSERT INTO property_utility_accounts (property_id, utility_key, account_number)
VALUES
  ('your-property-uuid', 'escondido_water', '12345678');
```

**Bulk import (recommended for many properties):** Use the CSV import script so you don’t run SQL for each property:

- **Script:** `npm run import-utility-accounts -- path/to/file.csv`  
  CSV format: either `property_id,account_number` or `address,city,state,zip_code,account_number` (script matches by address).
- **API:** `POST /api/admin/property-utility-accounts/import` with JSON `{ rows: [ { property_id, account_number } ] }` or CSV body. Admin only.
- See **Step 2** in “Step-by-step setup” above for full details.

## 2. Environment variables

For the script (and any worker that runs it):

| Variable | Required | Description |
|----------|----------|-------------|
| `ESCONDIDO_LOGIN_EMAIL` | Yes | Email used to log into Invoice Cloud (Escondido). |
| `ESCONDIDO_LOGIN_PASSWORD` | Yes | Password for that account. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS for inserts). |
| `ESCONDIDO_PROPERTY_ACCOUNTS` | No | JSON map if you don’t use DB: `{"property-uuid":"account-number",...}`. |

For the **cron API route** (optional):

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Secret for authorizing cron: `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`. |
| `BILL_FETCH_WEBHOOK_URL` | If set, GET/POST to the cron route will POST to this URL (e.g. your worker that runs the script). |

## 3. Running the fetcher script

Install Playwright (once) and run the script:

```bash
npm install playwright
# or: pnpm add playwright
npx playwright install chromium

npx tsx scripts/fetch-escondido-bills.ts
```

The script will:

1. Open the Escondido Invoice Cloud portal.
2. Log in with `ESCONDIDO_LOGIN_EMAIL` / `ESCONDIDO_LOGIN_PASSWORD`.
3. Scrape the bill list (table or list of links).
4. For each bill, resolve `property_id` via `property_utility_accounts` (or `ESCONDIDO_PROPERTY_ACCOUNTS`).
5. Upsert into `utility_provider_bills` (key: `property_id`, `utility_key`, `billing_period_start`).

If the portal layout changes, you may need to adjust selectors in `scripts/fetch-escondido-bills.ts` (see comments there).

## 4. Scheduling (continuous pull — required for full autonomy)

To have bills update **without any manual runs**, you must set up one of these. Until you do, the script only runs when you execute it yourself.

Playwright cannot run inside Vercel. Use one of these:

### Option A: GitHub Actions (recommended for zero-touch)

Add the workflow file below. Once you set the repo secrets, **nothing else is required** — GitHub runs the job on a schedule and when you trigger it manually if needed.

Add the workflow file below. A copy is included in the repo at `.github/workflows/fetch-escondido-bills.yml` — if you use it, you only need to add the secrets.

```yaml
name: Fetch Escondido bills
on:
  schedule:
    - cron: '0 8 * * *'   # daily 8 AM UTC
  workflow_dispatch:
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npx tsx scripts/fetch-escondido-bills.ts
        env:
          ESCONDIDO_LOGIN_EMAIL: ${{ secrets.ESCONDIDO_LOGIN_EMAIL }}
          ESCONDIDO_LOGIN_PASSWORD: ${{ secrets.ESCONDIDO_LOGIN_PASSWORD }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Add these **secrets** in the repo: **Settings → Secrets and variables → Actions** → New repository secret for each:

- `ESCONDIDO_LOGIN_EMAIL`
- `ESCONDIDO_LOGIN_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

After that, the job runs daily at 8 AM UTC and keeps `utility_provider_bills` updated with no manual steps.

### Option B: Vercel Cron + your worker

1. Deploy a small worker (e.g. Railway, Fly.io) that:
   - Exposes a POST endpoint.
   - On POST, runs `npx tsx scripts/fetch-escondido-bills.ts` (or the same logic).
2. In the Coast Metering app, set `BILL_FETCH_WEBHOOK_URL` to that worker’s URL.
3. In Vercel, add a cron that calls your app:

   ```
   GET https://your-app.vercel.app/api/cron/fetch-escondido-bills
   Authorization: Bearer <CRON_SECRET>
   ```

   The route will then POST to `BILL_FETCH_WEBHOOK_URL`, triggering the worker to run the script.

### Option C: Server cron

On a server or VM with Node and Playwright:

```bash
0 8 * * * cd /path/to/CoastMetering && npx tsx scripts/fetch-escondido-bills.ts
```

## 5. What gets stored

- **`utility_provider_bills`**  
  - One row per property per billing period.  
  - Fields: `property_id`, `utility_key` (`escondido_water`), `account_number`, `billing_period_start` / `billing_period_end`, `amount_due`, `due_date`, `pdf_url`, `external_id`, `fetched_at`.

Downstream you can:

- Use these rows as the “master” bill for each property/period.
- Combine with submeter data to split amounts by unit and create tenant bills (future automation).

## 6. Security and limits

- Use the **service role key** only in the script/worker and never expose it in the client.
- Store portal credentials in env/secrets (e.g. GitHub Actions secrets, worker env).
- The script runs in a headless browser; if the portal adds CAPTCHA or stricter bot detection, you may need to adjust (e.g. fewer runs, or contact the utility for an API).

## 7. Troubleshooting

- **No bills inserted**  
  - Confirm login works in a normal browser.  
  - Check that `property_utility_accounts` (or `ESCONDIDO_PROPERTY_ACCOUNTS`) maps account numbers to the correct `property_id`.  
  - Inspect the portal’s bill list (table vs list of links) and update selectors in `scripts/fetch-escondido-bills.ts` if the layout changed.


- **Works locally, fails in GitHub Actions**  
  - In CI the script records a **Playwright trace**. After a run, download the **escondido-debug** artifact (Actions → run → Artifacts). It may contain `trace.zip`.  
  - Open it locally: `npx playwright show-trace trace.zip`. Use the Trace Viewer to step through the run (screenshots, DOM snapshots, and action log) and see where login or navigation fails.  
  - See [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) and [this Stack Overflow thread](https://stackoverflow.com/questions/78915766/playwright-e2e-tests-passing-locally-but-failing-in-github-actions-with-next-js) for CI debugging tips (timing, viewport, auth detection).

- **Cron returns “Run the script”**  
  - Expected if `BILL_FETCH_WEBHOOK_URL` is not set. Either set it to a worker that runs the script, or run the script directly on a schedule (e.g. GitHub Actions, server cron).

- **Login page shows reCAPTCHA (e.g. "Privacy - Terms" badge)**  
  - **Bright Data Web Unlocker API (recommended):** Use the [new Unlocker API](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction) (Direct API — API key only). Create a Web Unlocker API at [Bright Data](https://brightdata.com/cp/web_access/new) → Web Access APIs → Create API → Web Unlocker API. Set **ESCONDIDO_BRIGHTDATA_API_KEY** to your API key (Bearer token from the zone Overview). Zone name defaults to `web_unlocker1`; set **ESCONDIDO_BRIGHTDATA_UNLOCKER_ZONE** only if you gave your API a different name. See [5-minute how-to](https://docs.brightdata.com/scraping-automation/web-unlocker/five-minute-how-to) and [Send your first request](https://docs.brightdata.com/scraping-automation/web-unlocker/send-your-first-request).
  - **When running locally**, captcha often does not appear.

- **Playwright errors on Vercel**  
  - Do not run the Playwright script inside Vercel. Run it in a separate environment (GitHub Actions, Railway, server, etc.) as above.
