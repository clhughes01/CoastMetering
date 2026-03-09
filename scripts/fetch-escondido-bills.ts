/**
 * Escondido Water (Invoice Cloud) bill fetcher.
 * Logs into https://www.invoicecloud.com/escondidoca, scrapes the bill list,
 * and inserts new bills into utility_provider_bills.
 *
 * Run: npx tsx scripts/fetch-escondido-bills.ts
 * Watch locally (see the browser): ESCONDIDO_WATCH=1 npm run fetch-escondido-bills
 * (Loads .env from project root so you don't need to pass credentials.)
 *
 * Required env (or in .env):
 *   ESCONDIDO_LOGIN_EMAIL, ESCONDIDO_LOGIN_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   Property-to-account mapping: property_utility_accounts table in Supabase,
 *   or ESCONDIDO_PROPERTY_ACCOUNTS='{"property-uuid":"account-number",...}'
 */
import "dotenv/config"

import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const PORTAL_URL = "https://www.invoicecloud.com/escondidoca"
const UTILITY_KEY = "escondido_water"

type FetchedBill = {
  accountNumber: string
  periodStart: string
  periodEnd: string
  amountDue: number
  dueDate: string | null
  externalId: string | null
  pdfUrl: string | null
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

async function getPropertyAccountMapping(supabase: any) {
  const { data, error } = await supabase
    .from("property_utility_accounts")
    .select("property_id, account_number")
    .eq("utility_key", UTILITY_KEY)
  if (error) throw new Error(`Failed to load property_utility_accounts: ${error.message}`)
  const map = new Map<string, string>()
  const rows = (data || []) as { property_id: string; account_number: string }[]
  for (const row of rows) {
    map.set(String(row.account_number).trim(), row.property_id)
  }
  if (map.size === 0) {
    const fallback = process.env.ESCONDIDO_PROPERTY_ACCOUNTS
    if (fallback) {
      try {
        const parsed = JSON.parse(fallback) as Record<string, string>
        for (const [account, propertyId] of Object.entries(parsed)) {
          map.set(String(account).trim(), propertyId)
        }
      } catch {
        console.warn("ESCONDIDO_PROPERTY_ACCOUNTS is not valid JSON, ignoring")
      }
    }
  }
  return map
}

function normalizeDate(s: string): string {
  const parts = s.replace(/\//g, "-").split("-")
  if (parts.length !== 3) return s
  const [a, b, c] = parts
  const year = c!.length === 2 ? `20${c}` : c
  const month = a!.length === 1 ? `0${a}` : a
  const day = b!.length === 1 ? `0${b}` : b
  return `${year}-${month}-${day}`
}

const log = (msg: string) => console.log(`[Escondido] ${msg}`)

/**
 * Get the frame that contains the Invoice Cloud portal (main frame after redirect or iframe).
 */
async function getPortalFrame(page: import("playwright").Page): Promise<import("playwright").Frame> {
  log("Resolving portal frame...")
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500)
    const url = page.url()
    if (url.includes("portal") || url.includes("Site2")) {
      log(`Using main frame (url has portal/Site2)`)
      return page.mainFrame()
    }
    for (const f of page.frames()) {
      if (f !== page.mainFrame()) {
        const u = f.url()
        if (u.includes("portal") || u.includes("Site2") || u.includes("invoicecloud")) {
          log(`Using iframe (url has portal/invoicecloud)`)
          return f
        }
      }
    }
  }
  for (const f of page.frames()) {
    try {
      if ((await f.locator('a:has-text("Sign In"), button:has-text("Sign In")').count()) > 0) {
        log("Using frame that contains Sign In")
        return f
      }
    } catch {
      continue
    }
  }
  log("Using main frame (fallback)")
  return page.mainFrame()
}

/**
 * Scrape bills from the Invoice Cloud portal.
 * Real flow (from UI): Landing → Sign In link → Login form → Dashboard → "Pay My Invoices" → Open Invoices table.
 */
async function scrapeBillsFromPortal(
  page: import("playwright").Page,
  loginEmail: string,
  loginPassword: string
): Promise<FetchedBill[]> {
  log("Loading portal...")
  await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(3000)
  log(`Page URL: ${page.url()}`)

  const frame = await getPortalFrame(page)
  const loc = (sel: string) => frame.locator(sel)

  // 1) Click "Sign In" link (top right) to open login form
  log("Looking for Sign In link...")
  const signInLink = loc('a:has-text("Sign In")').first()
  try {
    await signInLink.waitFor({ state: "visible", timeout: 10000 })
    await signInLink.click()
    log("Clicked Sign In link")
    await page.waitForTimeout(2000)
  } catch (e) {
    log(`Sign In link: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2) Fill login form and submit — must click the form's Sign In button (Enter doesn't submit on this site)
  log("Looking for email/password inputs...")
  const emailInput = loc('input[type="email"], input[name*="mail" i], input[id*="mail" i], input[placeholder*="mail" i], input[type="text"]').first()
  const passwordInput = loc('input[type="password"]').first()
  await emailInput.waitFor({ state: "visible", timeout: 15000 })
  log("Filling login...")
  await emailInput.fill(loginEmail)
  await passwordInput.fill(loginPassword)

  // Submit: click the form's Sign In button. Do NOT click the nav "Sign In" link (only one match = nav).
  let submitted = false

  try {
    const btnByRole = (frame as import("playwright").Frame).getByRole("button", { name: /sign\s*in/i })
    await btnByRole.waitFor({ state: "visible", timeout: 5000 })
    await btnByRole.click()
    log("Clicked submit (getByRole button)")
    submitted = true
  } catch {
    // not a native button
  }

  if (!submitted) {
    const formContainingPassword = passwordInput.locator("xpath=ancestor::form[1]")
    try {
      const submitInForm = formContainingPassword.locator('input[type="submit"], input[type="image"], button, a:has-text("Sign In")').first()
      await submitInForm.waitFor({ state: "visible", timeout: 5000 })
      await submitInForm.click()
      log("Clicked submit (form containing password → submit control)")
      submitted = true
    } catch {
      //
    }
  }

  if (!submitted) {
    try {
      const allSignIn = loc('a:has-text("Sign In"), button:has-text("Sign In"), input[value*="Sign" i], [role="button"]:has-text("Sign In")')
      const n = await allSignIn.count()
      if (n >= 2) {
        await allSignIn.nth(1).click()
        log("Clicked submit (second Sign In element)")
        submitted = true
      }
      // do NOT click when n === 1: that's the nav link, not the form button
    } catch {
      //
    }
  }

  if (!submitted) {
    try {
      await passwordInput.press("Enter")
      log("Submitted via Enter (fallback)")
    } catch {
      log("Could not submit form")
    }
  }

  // Wait for navigation away from login page (customerlogin.aspx → dashboard)
  log("Waiting for dashboard (leaving customerlogin)...")
  try {
    await page.waitForURL((url) => !url.href.includes("customerlogin"), { timeout: 25000 })
    log(`Navigated to: ${page.url()}`)
  } catch {
    log(`Still on: ${page.url()}`)
  }
  await page.waitForTimeout(3000)
  log(`After login URL: ${page.url()}`)

  // 3) Dashboard: click "Pay My Invoices" to open Open Invoices page (not My Account dropdown)
  log("Looking for Pay My Invoices...")
  const payInvoicesBtn = loc('button:has-text("Pay My Invoices"), a:has-text("Pay My Invoices")').first()
  try {
    await payInvoicesBtn.waitFor({ state: "visible", timeout: 15000 })
    await payInvoicesBtn.click()
    log("Clicked Pay My Invoices")
    await page.waitForTimeout(5000)
  } catch (e) {
    log(`Pay My Invoices: ${e instanceof Error ? e.message : String(e)}`)
  }

  const bills: FetchedBill[] = []
  const bodyText = await frame.locator("body").innerText()

  // 4) Open Invoices page: find every "View Invoice" link and parse its table row
  log("Looking for View Invoice links...")
  const viewInvoiceLinks = loc('a:has-text("View Invoice")')
  const linkCount = await viewInvoiceLinks.count()
  log(`Found ${linkCount} View Invoice link(s)`)

  if (linkCount > 0) {
    for (let i = 0; i < linkCount; i++) {
      const el = viewInvoiceLinks.nth(i)
      const href = (await el.getAttribute("href")) ?? ""
      const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
      const row = el.locator("xpath=ancestor::tr[1]")
      const rowText = (await row.count()) > 0 ? await row.innerText() : bodyText
      const accountMatch = rowText.match(/account\s*#?\s*(\d{4,})/i) || rowText.match(/#\s*(\d{4,})/i)
      const accountNumber = accountMatch ? accountMatch[1]!.trim() : ""
      const amountMatch = rowText.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = rowText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const dueDate = dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null
      bills.push({
        accountNumber,
        periodStart,
        periodEnd,
        amountDue: amount,
        dueDate,
        externalId: href ? href.slice(0, 500) : null,
        pdfUrl,
      })
      log(`  Bill ${i + 1}: account=${accountNumber} period=${periodStart} amount=$${amount}`)
    }
  }

  // 5) Fallback: parse any table with $ amounts and account # (e.g. Recent Open Invoices on dashboard)
  if (bills.length === 0) {
    log("Trying table fallback...")
    const tables = frame.locator("table")
    const tableCount = await tables.count()
    log(`Tables found: ${tableCount}`)
    for (let t = 0; t < tableCount; t++) {
      const table = tables.nth(t)
      const rows = table.locator("tbody tr")
      const rowCount = await rows.count()
      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i)
        const text = await row.innerText()
        if (!text.includes("$") || text.length < 5) continue
        const accountMatch = text.match(/account\s*#?\s*(\d{4,})/i) || text.match(/#\s*(\d{4,})/i)
        const accountNumber = accountMatch ? accountMatch[1]! : ""
        const amountMatch = text.match(/\$[\d,]+\.?\d*/)
        const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
        const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
        const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
        const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
        const dueDate = dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null
        const viewLink = row.locator('a:has-text("View Invoice"), a:has-text("View")').first()
        const href = (await viewLink.getAttribute("href").catch(() => null)) ?? null
        const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
        bills.push({
          accountNumber,
          periodStart,
          periodEnd,
          amountDue: amount,
          dueDate,
          externalId: href ? href.slice(0, 500) : null,
          pdfUrl,
        })
      }
      if (bills.length > 0) {
        log(`Parsed ${bills.length} bills from table`)
        break
      }
    }
  }

  if (bills.length === 0) {
    log("Saving debug screenshot and HTML...")
    try {
      await page.screenshot({ path: "debug-escondido.png", fullPage: true })
      const fs = await import("fs")
      fs.writeFileSync("debug-escondido.html", await page.content(), "utf8")
    } catch (e) {
      log(`Debug save failed: ${e}`)
    }
  }

  log(`Done. Parsed ${bills.length} bill(s).`)
  return bills
}

export async function runEscondidoBillFetch(options?: {
  browserWSEndpoint?: string
  loginEmail?: string
  loginPassword?: string
}): Promise<{ inserted: number; errors: string[] }> {
  const loginEmail = options?.loginEmail ?? process.env.ESCONDIDO_LOGIN_EMAIL
  const loginPassword = options?.loginPassword ?? process.env.ESCONDIDO_LOGIN_PASSWORD
  if (!loginEmail || !loginPassword) {
    throw new Error("Missing ESCONDIDO_LOGIN_EMAIL or ESCONDIDO_LOGIN_PASSWORD")
  }

  const supabase = getSupabase()
  const accountToProperty = await getPropertyAccountMapping(supabase)

  let browser: Awaited<ReturnType<typeof chromium.launch>> | Awaited<ReturnType<typeof chromium.connect>>
  if (options?.browserWSEndpoint) {
    browser = await chromium.connectOverCDP(options.browserWSEndpoint)
  } else {
    const headless = process.env.PLAYWRIGHT_HEADED !== "1"
    const watch = process.env.ESCONDIDO_WATCH === "1"
    browser = await chromium.launch({
      headless: watch ? false : headless,
      slowMo: watch ? 800 : 0,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,720",
      ],
    })
    if (watch) log("Watch mode: browser visible, actions slowed so you can see each step.")
  }

  const errors: string[] = []
  let inserted = 0

  try {
    const page = await browser.newPage()
    const bills = await scrapeBillsFromPortal(page, loginEmail, loginPassword)

    console.log(`Scraped ${bills.length} bill(s) from portal. Property mapping has ${accountToProperty.size} account(s).`)

    // If we have a single account in the mapping, use it for all bills from this login
    const defaultAccount =
      accountToProperty.size === 1 ? Array.from(accountToProperty.keys())[0] : null
    const defaultPropertyId = defaultAccount ? accountToProperty.get(defaultAccount) : null

    for (const bill of bills) {
      if (!bill.periodStart && !bill.pdfUrl) {
        errors.push(`Skipped bill (no period or PDF): ${JSON.stringify(bill)}`)
        continue
      }
      const periodStart = bill.periodStart || new Date().toISOString().slice(0, 10)
      const periodEnd = bill.periodEnd || periodStart
      const accountNumber = bill.accountNumber || defaultAccount || ""
      const propertyId = accountToProperty.get(accountNumber) || defaultPropertyId
      if (!propertyId) {
        errors.push(`No property mapped for account "${accountNumber}", skipping bill ${periodStart}`)
        continue
      }

      const { error } = await supabase.from("utility_provider_bills").upsert(
        {
          property_id: propertyId,
          utility_key: UTILITY_KEY,
          account_number: accountNumber,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          amount_due: bill.amountDue >= 0 ? bill.amountDue : 0,
          due_date: bill.dueDate,
          external_id: bill.externalId,
          pdf_url: bill.pdfUrl,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "property_id,utility_key,billing_period_start",
          ignoreDuplicates: false,
        }
      )
      if (error) {
        errors.push(`Insert failed ${periodStart}: ${error.message}`)
      } else {
        inserted++
      }
    }
  } finally {
    await browser.close()
  }

  return { inserted, errors }
}

async function main() {
  console.log("Starting Escondido bill fetch...")
  if (process.env.ESCONDIDO_WATCH === "1") {
    console.log("Tip: ESCONDIDO_WATCH=1 shows the browser and slows actions. Run locally to watch the bot.")
  }
  try {
    const result = await runEscondidoBillFetch()
    console.log(`Inserted ${result.inserted} bill(s).`)
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors)
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const isMain = process.argv[1]?.includes("fetch-escondido-bills")
if (isMain) {
  main()
}
