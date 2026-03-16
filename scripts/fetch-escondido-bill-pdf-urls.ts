/**
 * Escondido bill PDF URL fetcher — runs after email ingest (e.g. via GitHub Actions).
 *
 * For each utility_provider_bills row that has invoice_url but no pdf_url,
 * opens the invoice page (email.invoicecloud.net link), finds the "View Invoice"
 * link, and saves that URL as pdf_url (the actual bill PDF/view URL).
 *
 * Run: npx tsx scripts/fetch-escondido-bill-pdf-urls.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: ESCONDIDO_PDF_DEBUG=1 for verbose logs; DEBUG_OUTPUT_FILE for artifact log.
 */
import "dotenv/config"
import { chromium } from "playwright"
import { createSupabaseAdminClient } from "@/lib/supabase/client"
import * as fs from "fs"

const UTILITY_KEY = "escondido_water"
const DEBUG = process.env.ESCONDIDO_PDF_DEBUG === "1" || process.env.ESCONDIDO_PDF_DEBUG === "true"
const DEBUG_OUTPUT_FILE = process.env.DEBUG_OUTPUT_FILE?.trim()

const logLines: string[] = []
function log(...args: unknown[]) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")
  console.log("[escondido-pdf]", ...args)
  if (DEBUG_OUTPUT_FILE) logLines.push(`${new Date().toISOString()} [escondido-pdf] ${line}`)
}

function resolveHref(href: string, baseUrl: string): string {
  const s = href.trim()
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  try {
    return new URL(s, baseUrl).href
  } catch {
    return s
  }
}

async function main() {
  const supabase = createSupabaseAdminClient()

  const { data: bills, error: fetchError } = await supabase
    .from("utility_provider_bills")
    .select("id, invoice_url, account_number, invoice_number")
    .eq("utility_key", UTILITY_KEY)
    .not("invoice_url", "is", null)
    .is("pdf_url", null)
    .order("id", { ascending: true })

  if (fetchError) {
    log("Failed to fetch bills:", fetchError.message)
    process.exit(1)
  }

  if (!bills?.length) {
    log("No bills with invoice_url and missing pdf_url. Done.")
    writeDebugLog()
    return
  }

  log("Bills to process:", bills.length)

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  let updated = 0
  let failed = 0

  for (const bill of bills) {
    const invoiceUrl = (bill as { invoice_url: string }).invoice_url
    if (!invoiceUrl) continue

    const billId = (bill as { id: string }).id
    const account = (bill as { account_number?: string }).account_number
    const invNum = (bill as { invoice_number?: string }).invoice_number

    try {
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      })
      const page = await context.newPage()

      await page.goto(invoiceUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
      await page.waitForLoadState("networkidle").catch(() => {})

      // "View Invoice" link on the invoice summary page (City of Escondido / Invoice Cloud)
      const viewInvoiceLink = page.getByRole("link", { name: /View\s*Invoice/i }).first()
      await viewInvoiceLink.waitFor({ state: "visible", timeout: 15000 }).catch(() => {})

      const href = await viewInvoiceLink.getAttribute("href")
      const baseUrl = page.url()
      await context.close()

      if (!href) {
        log("No View Invoice href for bill", billId, account ?? invNum ?? "")
        failed++
        continue
      }

      const pdfUrl = resolveHref(href, baseUrl)
      const { error: updateError } = await supabase
        .from("utility_provider_bills")
        .update({
          pdf_url: pdfUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", billId)

      if (updateError) {
        log("Update failed for bill", billId, updateError.message)
        failed++
        continue
      }

      log("Updated bill", billId, "pdf_url:", pdfUrl.slice(0, 80) + "...")
      updated++
    } catch (err) {
      log("Error processing bill", billId, err instanceof Error ? err.message : String(err))
      failed++
    }
  }

  await browser.close()
  log("Done. Updated:", updated, "Failed:", failed)
  writeDebugLog()
}

function writeDebugLog() {
  if (!DEBUG_OUTPUT_FILE) return
  try {
    const body = logLines.length ? logLines.join("\n") : `${new Date().toISOString()} (no log lines)`
    fs.writeFileSync(DEBUG_OUTPUT_FILE, body, "utf8")
    console.log("Wrote debug log to", DEBUG_OUTPUT_FILE)
  } catch (e) {
    console.error("Failed to write debug log:", e)
  }
}

main().catch((err) => {
  console.error(err)
  writeDebugLog()
  process.exit(1)
})
