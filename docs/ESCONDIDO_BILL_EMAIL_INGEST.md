# Escondido Bill Email Ingest

Ingest Escondido Water bill notification emails so bills are created from the **"View invoice or pay now"** link (no portal login or captcha). Each email and bill are stored and linked so you can use the same link later for payment.

---

## Step-by-step setup (fully automated)

Follow these steps in order. You’ll set environment variables in Vercel and (if needed) create a Gmail App Password.

### Step 1: Run the database migration (one time)

1. Open your **Supabase** project → **SQL Editor**.
2. Open the file `supabase/utility-bill-emails.sql` in this repo and copy its full contents.
3. Paste into the SQL Editor and click **Run**.
4. This creates the `utility_bill_emails` table and adds `source_email_id` and `invoice_url` to `utility_provider_bills`. You only need to do this once.

### Step 2: Decide which inbox the cron will use

The daily cron logs into **one** email account via IMAP and looks for Escondido/Invoice Cloud bill emails there. The inbox can receive other mail too — the cron only processes messages whose **From** address looks like a bill sender (e.g. contains `invoicecloud`, `escondido`, or a noreply address with “bill”/“invoice”/“water”). All other emails are skipped. Choose one:

- **Option A:** Use the same Gmail (or other) inbox that already receives the bill notifications. No forwarding needed.
- **Option B:** Create a dedicated Gmail (e.g. `yourcompany.bills@gmail.com`) and in your main inbox set up **Gmail → Settings → Forwarding** so that emails from Invoice Cloud / Escondido are forwarded to this address. Then the cron will use this dedicated inbox.

You’ll need the **login email** and **password** (or App Password) for whichever inbox you choose.

### Step 3: Get an App Password (Gmail, if you use 2FA)

If the inbox is **Gmail** and you have 2-Step Verification on:

1. Go to [Google Account → Security](https://myaccount.google.com/security).
2. Under “How you sign in to Google,” click **2-Step Verification** and make sure it’s ON.
3. Back on Security, under “How you sign in to Google,” click **App passwords**.
4. Select app: **Mail**, device: **Other** (e.g. “CoastMetering cron”), then **Generate**.
5. Copy the **16-character password** (no spaces). This is what you’ll set as `ESCONDIDO_IMAP_PASSWORD`.  
   If you don’t have 2FA, you can use your normal Gmail password, but an App Password is more secure.

### Step 4: Create a secret for the cron (CRON_SECRET)

1. Pick a long random string (e.g. 32+ characters). You can generate one:  
   `openssl rand -hex 32` in a terminal, or use a password generator.
2. You’ll add this as the `CRON_SECRET` env var in Step 6. Vercel Cron will send this when it hits your endpoint so the route can verify the request is from your cron.

### Step 5: Collect the values you’ll set

Fill this out for yourself (then you’ll paste them into Vercel in Step 6):

| Variable | What to put | Where you get it |
|----------|-------------|-------------------|
| **CRON_SECRET** | The random secret from Step 4 | You created it. |
| **ESCONDIDO_IMAP_HOST** | `imap.gmail.com` (Gmail) or `outlook.office365.com` (Outlook) or your provider’s IMAP host | Gmail: `imap.gmail.com`. [Outlook](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353): `outlook.office365.com`. |
| **ESCONDIDO_IMAP_USER** | Full email address of the inbox | The address that receives (or is forwarded) the Escondido bill emails. |
| **ESCONDIDO_IMAP_PASSWORD** | Password for that inbox | Normal password, or the **App Password** from Step 3 (recommended for Gmail with 2FA). |
| **NEXT_PUBLIC_SUPABASE_URL** | Your Supabase project URL | Supabase → Project Settings → API → Project URL. |
| **SUPABASE_SERVICE_ROLE_KEY** | Your Supabase service role key | Supabase → Project Settings → API → `service_role` (secret) key. |

You do **not** need to set `ESCONDIDO_IMAP_PORT`, `ESCONDIDO_IMAP_TLS`, etc. unless you’re using a custom mail server; the defaults (port 993, TLS on) work for Gmail and Outlook.

### Step 6: Set environment variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → your **project** → **Settings** → **Environment Variables**.
2. Add each variable from the table in Step 5:
   - **Name:** exactly as in the table (e.g. `CRON_SECRET`, `ESCONDIDO_IMAP_HOST`, `ESCONDIDO_IMAP_USER`, `ESCONDIDO_IMAP_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
   - **Value:** the value you collected (paste the App Password or CRON_SECRET with no extra spaces).
   - **Environment:** check Production (and Preview if you want the cron in preview deployments).
3. Click **Save** for each. If you change any, redeploy the project so the new values are used.

### Step 7: Deploy and confirm the cron exists

1. Deploy your app (e.g. push to the branch connected to Vercel, or trigger a deploy from the Vercel dashboard).
2. In Vercel: **Settings** → **Crons** (or the Cron Jobs section). You should see one job that runs daily (e.g. at 12:00 UTC) and calls `/api/cron/ingest-escondido-emails`. No need to create it manually if `vercel.json` in the repo already defines it.

### Step 8: (Optional) Test the cron by hand

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

### Step 9: Ensure properties are mapped to utility accounts

Bills are attached to properties using `property_utility_accounts`. For Escondido Water, each property that has bills must have a row with `utility_key = 'escondido_water'` and the correct `account_number`. Add or import those in your admin (e.g. **Admin → Utility accounts** or the import endpoint) before or after setup. If only one property/account is mapped, that property is used for all ingested bills.

---

## Fully automated (overview)

A **daily cron** connects to your email inbox via IMAP, fetches recent bill emails from Invoice Cloud / Escondido, and ingests them. No forwarding or webhook setup — just point the app at an inbox that receives the bill emails.

1. **Use an inbox that receives the bill emails**  
   Forward Escondido/Invoice Cloud notifications to a dedicated mailbox (e.g. `bills@yourdomain.com` or a Gmail account), or read from the same inbox that already gets them.

2. **Set env vars** (e.g. in Vercel):
   - `CRON_SECRET` — Used to secure the cron endpoint (Vercel Cron sends this when it triggers the job).
   - `ESCONDIDO_IMAP_HOST` — e.g. `imap.gmail.com`, `outlook.office365.com`, or your provider’s IMAP host.
   - `ESCONDIDO_IMAP_USER` — Full email address.
   - `ESCONDIDO_IMAP_PASSWORD` — Password or **App Password** (Gmail: use an App Password if 2FA is on).
   - Optional: `ESCONDIDO_IMAP_PORT` (default 993), `ESCONDIDO_IMAP_TLS` (default true), `ESCONDIDO_IMAP_MAX_EMAILS` (default 20 per run), `ESCONDIDO_IMAP_DAYS_BACK` (default 7).

3. **Deploy**  
   The repo includes `vercel.json` with a cron that calls `/api/cron/ingest-escondido-emails` **once a day at 12:00 UTC**. On Vercel, set `CRON_SECRET` in the project env; the Cron Job will send it when invoking the route.

4. **Done**  
   Each run fetches the last 7 days of mail (up to 20 messages), skips already-processed emails, and ingests new ones. Bills are created and linked to the stored email and invoice URL.

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

Optional for cron: `ESCONDIDO_IMAP_PORT` (993), `ESCONDIDO_IMAP_TLS` (true), `ESCONDIDO_IMAP_MAX_EMAILS` (20), `ESCONDIDO_IMAP_DAYS_BACK` (7).

Property → account mapping must exist in `property_utility_accounts` (utility_key = `escondido_water`) so bills can be attached to the correct property. If only one account is mapped, that property is used for all ingested bills from the email.
