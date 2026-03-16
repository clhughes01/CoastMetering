# Escondido Bill Email Ingest

Ingest Escondido Water bill notification emails so bills are created from the **"View invoice or pay now"** link (no portal login or captcha). Each email and bill are stored and linked so you can use the same link later for payment.

**The ingest runs via GitHub Actions** (daily schedule + manual trigger), not Vercel cron. This keeps workflow automation in one place and gives you a **watch debug log** on every run.

---

## Step-by-step setup (fully automated)

Follow these steps in order. You’ll set environment variables in Vercel and (if needed) create a Gmail App Password.

### Step 1: Run the database migration (one time)

1. Open your **Supabase** project → **SQL Editor**.
2. Open the file `supabase/utility-bill-emails.sql` in this repo and copy its full contents.
3. Paste into the SQL Editor and click **Run**.
4. This creates the `utility_bill_emails` table and adds `source_email_id` and `invoice_url` to `utility_provider_bills`. You only need to do this once.
5. **Optional but recommended:** Run `supabase/migrations/utility_provider_bills_nullable_property.sql` in the SQL Editor so bills can be created even when no property is mapped yet (you can assign the property later).

### Step 2: Decide which inbox the workflow will use

The workflow logs into **one** email account via IMAP and looks for Escondido/Invoice Cloud bill emails there. The inbox can receive other mail too — the cron only processes messages whose **From** address looks like a bill sender (e.g. contains `invoicecloud`, `escondido`, or a noreply address with “bill”/“invoice”/“water”). Only emails that actually contain **invoice links** in the body are stored and turned into bills; all others are skipped. Forwarded emails (e.g. from `coastmetering@gmail.com`) are accepted by default; add more via `ESCONDIDO_IMAP_ALLOWED_FORWARDERS`. Choose one:

- **Option A:** Use the same Gmail (or other) inbox that already receives the bill notifications. No forwarding needed.
- **Option B:** Create a dedicated Gmail (e.g. `yourcompany.bills@gmail.com`) and in your main inbox set up **Gmail → Settings → Forwarding** so that emails from Invoice Cloud / Escondido are forwarded to this address. Then the workflow will use this dedicated inbox.

You’ll need the **login email** and **password** (or App Password) for whichever inbox you choose.

### Step 3: Get an App Password (Gmail, if you use 2FA)

If the inbox is **Gmail** and you have 2-Step Verification on:

1. Go to [Google Account → Security](https://myaccount.google.com/security).
2. Under “How you sign in to Google,” click **2-Step Verification** and make sure it’s ON.
3. Back on Security, under “How you sign in to Google,” click **App passwords**.
4. Select app: **Mail**, device: **Other** (e.g. “CoastMetering cron”), then **Generate**.
5. Copy the **16-character password** (no spaces). This is what you’ll set as `ESCONDIDO_IMAP_PASSWORD`.  
   If you don’t have 2FA, you can use your normal Gmail password, but an App Password is more secure.

### Step 4: Add GitHub Actions secrets

1. In your repo: **Settings** → **Secrets and variables** → **Actions**.
2. Add these **repository secrets** (name exactly as below):

| Secret name | What to put |
|-------------|-------------|
| **ESCONDIDO_IMAP_HOST** | `imap.gmail.com` (Gmail) or `outlook.office365.com` (Outlook). |
| **ESCONDIDO_IMAP_USER** | Full email address of the inbox that receives (or is forwarded) Escondido bill emails. |
| **ESCONDIDO_IMAP_PASSWORD** | Password or **App Password** from Step 3 (Gmail with 2FA: use App Password). |
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase → Project Settings → API → Project URL. |
| **SUPABASE_SERVICE_ROLE_KEY** | Supabase → Project Settings → API → `service_role` (secret) key. |

Optional: `ESCONDIDO_IMAP_PORT`, `ESCONDIDO_IMAP_MAX_EMAILS`, `ESCONDIDO_IMAP_DAYS_BACK`, `ESCONDIDO_IMAP_ALLOWED_FORWARDERS` — the script uses defaults if not set.

### Step 5: Run the workflow

- **Schedule:** The workflow **Ingest Escondido bill emails** runs **daily at 12:00 UTC** (see `.github/workflows/ingest-escondido-emails.yml`).
- **Manual run:** **Actions** → **Ingest Escondido bill emails** → **Run workflow**.

### Step 6: Watch debug output

Every run uses **watch debug** so you can see what the ingest did:

- **Actions** → open the latest **Ingest Escondido bill emails** run → **ingest** job. The step "Run Escondido email ingest (with watch debug)" prints link extraction, first-page parse (account, pdfUrl), "Following View Invoice link" and redirect final URL, any rejected compliance/feed URL, and the final `pdf_url` stored per bill.
- **Artifact:** Download **escondido-ingest-debug** to get `escondido-ingest-debug.log` with the same lines (timestamped).

Use this to confirm the correct account number and that `pdf_url` is a real document URL (e.g. `docs.onlinebiller.com`), not a feed or compliance URL.

---

*(The following steps 5–8 about Vercel cron are kept for reference if you want to trigger ingest via the API route.)*

### Step 5 (Vercel): Collect the values you'll set

Fill this out for yourself (then you'll paste them into Vercel in Step 6):

| Variable | What to put | Where you get it |
|----------|-------------|-------------------|
| **CRON_SECRET** | The random secret from Step 4 | You created it. |
| **ESCONDIDO_IMAP_HOST** | `imap.gmail.com` (Gmail) or `outlook.office365.com` (Outlook) or your provider's IMAP host | Gmail: `imap.gmail.com`. [Outlook](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353): `outlook.office365.com`. |
| **ESCONDIDO_IMAP_USER** | Full email address of the inbox | The address that receives (or is forwarded) the Escondido bill emails. |
| **ESCONDIDO_IMAP_PASSWORD** | Password for that inbox | Normal password, or the **App Password** from Step 3 (recommended for Gmail with 2FA). |
| **NEXT_PUBLIC_SUPABASE_URL** | Your Supabase project URL | Supabase → Project Settings → API → Project URL. |
| **SUPABASE_SERVICE_ROLE_KEY** | Your Supabase service role key | Supabase → Project Settings → API → `service_role` (secret) key. |

You do **not** need to set `ESCONDIDO_IMAP_PORT`, `ESCONDIDO_IMAP_TLS`, etc. unless you're using a custom mail server; the defaults (port 993, TLS on) work for Gmail and Outlook.

### Step 6 (Vercel): Set environment variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → your **project** → **Settings** → **Environment Variables**.
2. Add each variable from the table in Step 5:
   - **Name:** exactly as in the table (e.g. `CRON_SECRET`, `ESCONDIDO_IMAP_HOST`, `ESCONDIDO_IMAP_USER`, `ESCONDIDO_IMAP_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
   - **Value:** the value you collected (paste the App Password or CRON_SECRET with no extra spaces).
   - **Environment:** check Production (and Preview if you want the cron in preview deployments).
3. Click **Save** for each. If you change any, redeploy the project so the new values are used.

### Step 7 (Vercel): Deploy and confirm the cron exists

1. Deploy your app (e.g. push to the branch connected to Vercel, or trigger a deploy from the Vercel dashboard).
2. In Vercel: **Settings** → **Crons** (or the Cron Jobs section). You should see one job that runs daily (e.g. at 12:00 UTC) and calls `/api/cron/ingest-escondido-emails`. No need to create it manually if `vercel.json` in the repo already defines it.

### Step 8 (Optional): Test the cron by hand

To run the ingest once without waiting for the schedule:

1. Get your `CRON_SECRET` (the same value you set in Vercel).
2. In a terminal (or Postman):

   ```bash
   curl -X GET "https://YOUR_APP.vercel.app/api/cron/ingest-escondido-emails" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

   Or with the secret in the URL (only for testing):

   ```bash
   curl "https://YOUR_APP.vercel.app/api/cron/ingest-escondido-emails?secret=YOUR_CRON_SECRET"
   ```

3. Replace `YOUR_APP` and `YOUR_CRON_SECRET` with your real values. A successful run returns JSON like `{ "ok": true, "processed": N, "totalBills": M, "details": [...] }`.

---

*(End of Vercel cron reference. Primary method is GitHub Actions above.)*



## How to verify it worked

**When using GitHub Actions:** Open **Actions** → **Ingest Escondido bill emails** → latest run. The job log shows each step (link extraction, parse, redirect, pdf_url). Download the **escondido-ingest-debug** artifact for the full timestamped log. Check Supabase (`utility_bill_emails`, `utility_provider_bills`) for new rows.

**Optional (Vercel API route):** If you still use the cron endpoint:

**1. Trigger the cron manually**

In a terminal (use your real Vercel URL and `CRON_SECRET`):

```bash
curl -s -X GET "https://YOUR_APP.vercel.app/api/cron/ingest-escondido-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- **`{ "ok": true, "processed": 0, "totalBills": 0, "details": [] }`** — Worked. IMAP connected and ran; no bill emails were in the last 7 days (or they were already processed). Safe.
- **`{ "ok": true, "processed": 2, "totalBills": 2, "details": [...] }`** — Worked. It processed 2 emails and created/updated 2 bills.
- **`{ "error": "Unauthorized" }`** — Wrong or missing `CRON_SECRET`. Check the header or query param.
- **`{ "error": "Missing IMAP config", ... }`** — One of `ESCONDIDO_IMAP_HOST`, `ESCONDIDO_IMAP_USER`, or `ESCONDIDO_IMAP_PASSWORD` is not set in Vercel (or not present after redeploy).
- **`{ "ok": false, "error": "..." }`** — Often an IMAP/auth problem (e.g. wrong App Password, 2FA blocking). Read the `error` message.

**2. Check Vercel**

- **Deployments** — Your latest deploy should show “Ready”. Redeploy if you added env vars after the last deploy.
- **Cron** — **Project → Settings → Crons** (or **Logs** filtered by the cron path). After the next scheduled run (e.g. 12:00 UTC), you’ll see a request to `/api/cron/ingest-escondido-emails` and its response.
- **Logs / Functions** — Open a deployment → **Functions** or **Logs**, trigger the cron (or wait for the schedule), and look for that route’s log line and any error stack.

**3. Check Supabase**

- **Table Editor → `utility_bill_emails`** — New rows appear when an email was ingested (subject, from_address, etc.).
- **Table Editor → `utility_provider_bills`** — New or updated rows have `source_email_id` and `invoice_url` set when a bill was created from an email.

If the manual `curl` returns `ok: true`, the cron is working. `processed: 0` just means no (new) bill emails were found in the last 7 days.

---

## Troubleshooting

**`[AUTHENTICATIONFAILED] Invalid credentials (Failure)` (Gmail IMAP)**

1. **Use an App Password** — Normal Gmail password does not work with IMAP when 2-Step Verification is on. Google Account → Security → 2-Step Verification → App passwords → create one for **Mail** / **Other (e.g. "CoastMetering")**. Copy the **16-character** password (e.g. `abcdefghijklmnop`); Gmail may show it with spaces — paste **without** spaces.
2. **Test locally** — In the project root, add to `.env`: `ESCONDIDO_IMAP_HOST=imap.gmail.com`, `ESCONDIDO_IMAP_USER=your@gmail.com`, `ESCONDIDO_IMAP_PASSWORD=your16charapppassword`. Run `npx tsx scripts/test-imap-login.ts`. If it says "IMAP login OK", the credentials work; then the issue is how they’re set in Vercel.
3. **Set in Vercel** — Delete the existing `ESCONDIDO_IMAP_PASSWORD` variable and add it again. Paste only the 16 characters, no spaces or newlines. Ensure it’s set for **Production** (or the environment your cron uses).
4. **Redeploy** — Deployments → ⋮ on latest deployment → **Redeploy**. Cron uses the env from the deployment; a new run alone does not reload env.
5. **Gmail** — Settings → See all settings → Forwarding and POP/IMAP → **Enable IMAP**. Use the same Gmail account for the App Password as `ESCONDIDO_IMAP_USER`.

### Step 9: Ensure properties are mapped to utility accounts

Bills are attached to properties using `property_utility_accounts`. For Escondido Water, each property that has bills must have a row with `utility_key = 'escondido_water'` and the correct `account_number`. Add or import those in your admin (e.g. **Admin → Utility accounts** or the import endpoint) before or after setup. If only one property/account is mapped, that property is used for all ingested bills.

---

## Fully automated (overview)

The **Ingest Escondido bill emails** GitHub Action runs **daily at 12:00 UTC** and connects to your email inbox via IMAP, fetches recent bill emails from Invoice Cloud / Escondido, and ingests them. No forwarding or webhook setup — just add the secrets and point the workflow at an inbox that receives the bill emails.

1. **Use an inbox that receives the bill emails**  
   Forward Escondido/Invoice Cloud notifications to a dedicated mailbox (e.g. `bills@yourdomain.com` or a Gmail account), or read from the same inbox that already gets them.

2. **Set env vars** (e.g. in Vercel):
   - `CRON_SECRET` — Used to secure the cron endpoint (Vercel Cron sends this when it triggers the job).
   - `ESCONDIDO_IMAP_HOST` — e.g. `imap.gmail.com`, `outlook.office365.com`, or your provider’s IMAP host.
   - `ESCONDIDO_IMAP_USER` — Full email address.
   - `ESCONDIDO_IMAP_PASSWORD` — Password or **App Password** (Gmail: use an App Password if 2FA is on).
   - Optional: `ESCONDIDO_IMAP_PORT` (default 993), `ESCONDIDO_IMAP_TLS` (default true), `ESCONDIDO_IMAP_MAX_EMAILS` (default 50 per run), `ESCONDIDO_IMAP_DAYS_BACK` (default 7).

3. **Deploy**  
   The repo includes `vercel.json` with a cron that calls `/api/cron/ingest-escondido-emails` **once a day at 12:00 UTC**. On Vercel, set `CRON_SECRET` in the project env; the Cron Job will send it when invoking the route.

4. **Done**  
   Each run fetches the last 7 days of mail (up to 50 messages, most recent first), skips already-processed emails, and ingests new ones. Bills are created and linked to the stored email and invoice URL.

To run the job manually:  
`GET https://your-app.vercel.app/api/cron/ingest-escondido-emails` with `Authorization: Bearer YOUR_CRON_SECRET` (or `?secret=YOUR_CRON_SECRET`).

## How it works

1. You receive the bill notification email from Invoice Cloud / Escondido.
2. The email is sent to the ingest API (forward rule or webhook).
3. The API finds links to `invoicecloud.com` (view/invoice/pay), fetches each invoice page, parses amount, due date, account #, and PDF link.
4. The email is stored in `utility_bill_emails` and each bill is upserted into `utility_provider_bills` with `source_email_id` and `invoice_url` set. Later you can open `invoice_url` to pay.

## Database

- **utility_bill_emails** — One row per ingested email (subject, from, body, etc.).
- **utility_provider_bills** — New columns:
  - **source_email_id** — Links the bill to the email it came from.
  - **invoice_url** — The "View invoice or pay now" URL for this bill (use for payment).

Run the migration once:

```bash
# In Supabase SQL Editor, run:
# supabase/utility-bill-emails.sql
```

## API

**POST /api/ingest/escondido-bill-email**

- **Auth:** Set `INGEST_ESCONDIDO_EMAIL_SECRET` in env; send `Authorization: Bearer <secret>`.
- **Body (JSON):**
  ```json
  {
    "from": "noreply@invoicecloud.com",
    "subject": "Your water bill is ready",
    "date": "2025-01-15T10:00:00Z",
    "html": "<html>... <a href=\"https://www.invoicecloud.com/...\">View invoice or pay now</a> ...</html>",
    "text": "Optional plain text",
    "message_id": "optional-message-id-for-dedup"
  }
  ```
- **Body (form):** For SendGrid/Mailgun webhooks use `from`, `subject`, `html`, `text`, `date` (or `Received`), `Message-Id` (or `message_id`).

Response: `{ ok: true, email_id, links_found, results: [{ url, bill_id? }, ...] }`.

## Setting up forwarding

### Option A: Gmail forwarding + webhook

1. Create an address that receives the webhook (e.g. SendGrid Inbound Parse, Mailgun, or a small worker that parses email and POSTs to your API).
2. In Gmail: **Settings → Forwarding** — add the forwarding address. Or create a filter: "From: invoicecloud.com" → Forward to that address.
3. Configure the receiving service to POST the email (from, subject, html, text) to:
   ```
   POST https://your-app.vercel.app/api/ingest/escondido-bill-email
   Authorization: Bearer YOUR_INGEST_ESCONDIDO_EMAIL_SECRET
   Content-Type: application/json
   ```
   with body `{ from, subject, date, html, text, message_id }`.

### Option B: SendGrid Inbound Parse

1. In SendGrid: **Settings → Inbound Parse** — add a host (e.g. `bills.yourdomain.com`) and set the destination URL to your app (e.g. `https://your-app.vercel.app/api/ingest/escondido-bill-email`).
2. Add a subdomain MX record so SendGrid receives the emails.
3. In your app, either use the route as-is (SendGrid sends form data) or map their form fields to the expected names (`body-html`, `body-plain`, etc.). The route accepts both JSON and form.

### Option C: Manual test

To test without email setup, paste the raw HTML of a bill email and call the API:

```bash
curl -X POST "https://your-app.vercel.app/api/ingest/escondido-bill-email" \
  -H "Authorization: Bearer YOUR_INGEST_ESCONDIDO_EMAIL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@invoicecloud.com","subject":"Test","html":"<a href=\"https://www.invoicecloud.com/portal/.../invoice.aspx?...\">View invoice or pay now</a>"}'
```

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| CRON_SECRET | For cron | Secures `/api/cron/ingest-escondido-emails`; set in Vercel and used by the cron trigger. |
| ESCONDIDO_IMAP_HOST | For cron | IMAP server (e.g. `imap.gmail.com`). |
| ESCONDIDO_IMAP_USER | For cron | Mailbox login (full email). |
| ESCONDIDO_IMAP_PASSWORD | For cron | Password or App Password (Gmail with 2FA). |
| INGEST_ESCONDIDO_EMAIL_SECRET | For POST ingest | Bearer token for `POST /api/ingest/escondido-bill-email`. |
| NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | Yes | Used to insert emails and bills. |

Optional for cron: `ESCONDIDO_IMAP_PORT` (993), `ESCONDIDO_IMAP_TLS` (true), `ESCONDIDO_IMAP_MAX_EMAILS` (50), `ESCONDIDO_IMAP_DAYS_BACK` (7). **ESCONDIDO_IMAP_ALLOWED_FORWARDERS** — Comma-separated list of sender addresses to treat as bill emails (e.g. when bills are forwarded). Default includes `coastmetering@gmail.com`.

Property → account mapping must exist in `property_utility_accounts` (utility_key = `escondido_water`) so bills can be attached to the correct property. If only one account is mapped, that property is used for all ingested bills from the email.
