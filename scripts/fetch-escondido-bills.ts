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

/**
 * Scrape bills from the Invoice Cloud portal after login.
 * Flow: Login → My Account dropdown → "View or Pay Open Invoices" → parse each "View Invoice" button/row.
 */
async function scrapeBillsFromPortal(
  page: import("playwright").Page,
  loginEmail: string,
  loginPassword: string
): Promise<FetchedBill[]> {
  await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 })

  // Login
  const emailSel = 'input[type="email"], input[name*="email"], input[id*="email"]'
  const passwordSel = 'input[type="password"], input[name*="password"]'
  const submitSel = 'button[type="submit"], input[type="submit"], button:has-text("Sign In"), a:has-text("Sign In")'

  const email = page.locator(emailSel).first()
  if ((await email.count()) > 0) {
    await email.fill(loginEmail)
    await page.locator(passwordSel).first().fill(loginPassword)
    await page.locator(submitSel).first().click()
    await page.waitForTimeout(3000)
  }

  // My Account dropdown
  const myAccount = page.getByText("My Account", { exact: true }).first()
  if ((await myAccount.count()) > 0) {
    await myAccount.click()
    await page.waitForTimeout(1500)
  }

  // "View or Pay Open Invoices" — can be a link or button
  const viewOrPay = page.getByText("View or Pay Open Invoices", { exact: true }).first()
  if ((await viewOrPay.count()) > 0) {
    await viewOrPay.click()
    await page.waitForTimeout(4000)
  }

  const bills: FetchedBill[] = []

  const bodyText = await page.locator("body").innerText()
  const accountOnPage = bodyText.match(/account\s*#?\s*[:\s]*(\d{4,})/i) || bodyText.match(/#\s*(\d{4,})/i)
  const pageAccountNumber = accountOnPage ? accountOnPage[1]!.trim() : ""

  // "View Invoice" — blue button (or link); each one = one bill
  const viewInvoiceButtons = page.getByRole("button", { name: "View Invoice" })
  const viewInvoiceLinks = page.getByRole("link", { name: "View Invoice" })
  const buttonCount = await viewInvoiceButtons.count()
  const linkCount = await viewInvoiceLinks.count()
  const totalViewInvoice = buttonCount + linkCount

  if (totalViewInvoice > 0) {
    for (let i = 0; i < totalViewInvoice; i++) {
      const isButton = i < buttonCount
      const el = isButton ? viewInvoiceButtons.nth(i) : viewInvoiceLinks.nth(i - buttonCount)
      const href = !isButton ? ((await el.getAttribute("href")) || "") : ""
      const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
      const row = el.locator("xpath=ancestor::tr | xpath=ancestor::div[contains(@class,'row')] | xpath=ancestor::li | xpath=ancestor::*[contains(@class,'invoice') or contains(@class,'bill')]").first()
      const rowText = (await row.count()) > 0 ? await row.innerText() : bodyText
      const amountMatch = rowText.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = rowText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const dueDate = dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null
      const accountMatch = rowText.match(/account\s*#?\s*[:\s]*(\d{4,})/i) || rowText.match(/#\s*(\d{4,})/i)
      const accountNumber = accountMatch ? accountMatch[1]!.trim() : pageAccountNumber

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

  // Fallback: any clickable with exact text "View Invoice"
  if (bills.length === 0) {
    const anyViewInvoice = page.locator('button:has-text("View Invoice"), a:has-text("View Invoice")')
    const count = await anyViewInvoice.count()
    for (let i = 0; i < count; i++) {
      const el = anyViewInvoice.nth(i)
      const href = (await el.getAttribute("href")) || ""
      const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
      const row = el.locator("xpath=ancestor::tr").first()
      const rowText = (await row.count()) > 0 ? await row.innerText() : bodyText
      const amountMatch = rowText.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = rowText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const accountMatch = rowText.match(/#\s*(\d{4,})/i)
      const accountNumber = accountMatch ? accountMatch[1]!.trim() : pageAccountNumber
      bills.push({
        accountNumber,
        periodStart,
        periodEnd,
        amountDue: amount,
        dueDate: dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null,
        externalId: href ? href.slice(0, 500) : null,
        pdfUrl,
      })
    }
  }

  // Fallback: table rows
  if (bills.length === 0) {
    const table = page.locator("table").first()
    const rows = table.locator("tbody tr")
    const rowCount = await rows.count()
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      const text = await row.innerText()
      const accountMatch = text.match(/#\s*(\d{4,})/i)
      const accountNumber = accountMatch ? accountMatch[1]! : pageAccountNumber
      const amountMatch = text.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const viewLink = row.locator('a[href*="invoice"], a[href*="pdf"], a:has-text("View"), button:has-text("View")').first()
      const href = (await viewLink.getAttribute("href")) || null
      const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
      bills.push({
        accountNumber,
        periodStart,
        periodEnd,
        amountDue: amount,
        dueDate: dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null,
        externalId: href ? href.slice(0, 500) : null,
        pdfUrl,
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
