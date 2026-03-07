/**
 * Escondido Water (Invoice Cloud) bill fetcher.
 * Logs into https://www.invoicecloud.com/escondidoca, scrapes the bill list,
 * and inserts new bills into utility_provider_bills.
 *
 * Run with: npx tsx scripts/fetch-escondido-bills.ts
 * Or from a cron worker / GitHub Action that has Playwright installed.
 *
 * Required env:
 *   ESCONDIDO_LOGIN_EMAIL, ESCONDIDO_LOGIN_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   Property-to-account mapping: property_utility_accounts table in Supabase,
 *   or ESCONDIDO_PROPERTY_ACCOUNTS='{"property-uuid":"account-number",...}'
 */

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

async function getPropertyAccountMapping(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("property_utility_accounts")
    .select("property_id, account_number")
    .eq("utility_key", UTILITY_KEY)
  if (error) throw new Error(`Failed to load property_utility_accounts: ${error.message}`)
  const map = new Map<string, string>()
  for (const row of data || []) {
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

/**
 * Scrape bills from the Invoice Cloud portal after login.
 * Selectors may need to be updated if the portal changes.
 */
async function scrapeBillsFromPortal(
  page: import("playwright").Page,
  loginEmail: string,
  loginPassword: string
): Promise<FetchedBill[]> {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle", timeout: 30000 })

  // Login: typical Invoice Cloud form
  const emailSel = 'input[type="email"], input[name*="email"], input[id*="email"]'
  const passwordSel = 'input[type="password"], input[name*="password"]'
  const submitSel = 'button[type="submit"], input[type="submit"], a:has-text("Sign In"), button:has-text("Sign In")'

  const email = page.locator(emailSel).first()
  const password = page.locator(passwordSel).first()
  const submit = page.locator(submitSel).first()

  if ((await email.count()) > 0) {
    await email.fill(loginEmail)
    await password.fill(loginPassword)
    await submit.click()
    await page.waitForURL(/invoicecloud\.com/, { timeout: 15000 }).catch(() => {})
  }

  await page.waitForTimeout(2000)

  const bills: FetchedBill[] = []
  const table = page.locator("table").first()
  const tableRows = table.locator("tbody tr")
  const rowCount = await tableRows.count()

  if (rowCount > 0) {
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i)
      const text = await row.innerText()
      const accountMatch = text.match(/account\s*#?\s*(\d+)/i) || text.match(/#\s*(\d{4,})/i)
      const accountNumber = accountMatch ? accountMatch[1]! : ""
      const amountMatch = text.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const dueDate = dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null
      const link = row.locator("a[href*='pdf'], a[href*='invoice'], a[href*='view']").first()
      const href = (await link.getAttribute("href")) || null
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
  }

  if (bills.length === 0) {
    const links = page.locator('a[href*="invoice"], a[href*="bill"], [data-testid*="bill"]')
    const count = await links.count()
    for (let i = 0; i < Math.min(count, 24); i++) {
      const el = links.nth(i)
      const text = await el.innerText()
      const amountMatch = text.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const pdfUrl = (await el.getAttribute("href")) || null
      bills.push({
        accountNumber: "",
        periodStart,
        periodEnd,
        amountDue: amount,
        dueDate: dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null,
        externalId: pdfUrl ? pdfUrl.slice(0, 500) : null,
        pdfUrl: pdfUrl ? (pdfUrl.startsWith("http") ? pdfUrl : new URL(pdfUrl, PORTAL_URL).href) : null,
      })
    }
  }

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
    browser = await chromium.launch({ headless: true })
  }

  const errors: string[] = []
  let inserted = 0

  try {
    const page = await browser.newPage()
    const bills = await scrapeBillsFromPortal(page, loginEmail, loginPassword)

    // If we have a single account in the mapping, use it for all bills from this login
    const defaultAccount =
      accountToProperty.size === 1 ? Array.from(accountToProperty.keys())[0] : null
    const defaultPropertyId = defaultAccount ? accountToProperty.get(defaultAccount) : null

    for (const bill of bills) {
      if (!bill.periodStart || bill.amountDue <= 0) continue
      const accountNumber = bill.accountNumber || defaultAccount || "default"
      const propertyId = accountToProperty.get(accountNumber) || defaultPropertyId
      if (!propertyId) {
        errors.push(`No property mapped for account ${accountNumber}, skipping bill ${bill.periodStart}`)
        continue
      }

      const { error } = await supabase.from("utility_provider_bills").upsert(
        {
          property_id: propertyId,
          utility_key: UTILITY_KEY,
          account_number: accountNumber,
          billing_period_start: bill.periodStart,
          billing_period_end: bill.periodEnd,
          amount_due: bill.amountDue,
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
        errors.push(`Insert failed ${bill.periodStart}: ${error.message}`)
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
