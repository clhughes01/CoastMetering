/**
 * Escondido bill PDF fetcher — runs after email ingest (e.g. via GitHub Actions).
 *
 * For each utility_provider_bills row that has invoice_url but no pdf_url,
 * opens the invoice page, finds the "View Invoice" link, downloads the PDF,
 * uploads it to Supabase Storage (utility-bill-pdfs), and sets pdf_url to the
 * stored file's public URL so the bill is available even if the provider link expires.
 *
 * Run: npx tsx scripts/fetch-escondido-bill-pdf-urls.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: ESCONDIDO_PDF_DEBUG=1, DEBUG_OUTPUT_FILE, ESCONDIDO_PDF_DELAY_MS (delay between bills).
 */
import "dotenv/config"
import { chromium } from "playwright"
import { createSupabaseAdminClient } from "@/lib/supabase/client"
import * as fs from "fs"

const UTILITY_KEY = "escondido_water"
const PDF_STORAGE_BUCKET = "utility-bill-pdfs"
const DEBUG = process.env.ESCONDIDO_PDF_DEBUG === "1" || process.env.ESCONDIDO_PDF_DEBUG === "true"
const DEBUG_OUTPUT_FILE = process.env.DEBUG_OUTPUT_FILE?.trim()
const DELAY_MS = Math.max(0, parseInt(process.env.ESCONDIDO_PDF_DELAY_MS ?? "1000", 10))

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

async function ensureBucket(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === PDF_STORAGE_BUCKET)) return
  const { error } = await supabase.storage.createBucket(PDF_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB per file
  })
  if (error) {
    log("Bucket create failed (may already exist):", error.message)
  }
}

async function main() {
  const supabase = createSupabaseAdminClient()

  await ensureBucket(supabase)

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

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i] as { id: string; invoice_url: string | null; account_number?: string; invoice_number?: string }
    const invoiceUrl = bill.invoice_url
    if (!invoiceUrl) continue

    const billId = bill.id

    if (i > 0 && DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }

    try {
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      })
      const page = await context.newPage()

      await page.goto(invoiceUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
      await page.waitForLoadState("networkidle").catch(() => {})

      const viewInvoiceLink = page.getByRole("link", { name: /View\s*Invoice/i }).first()
      await viewInvoiceLink.waitFor({ state: "visible", timeout: 15000 }).catch(() => {})

      const href = await viewInvoiceLink.getAttribute("href")
      const baseUrl = page.url()
      if (!href) {
        await context.close()
        log("No View Invoice href for bill", billId, bill.account_number ?? bill.invoice_number ?? "")
        failed++
        continue
      }

      const pdfPageUrl = resolveHref(href, baseUrl)
      const response = await context.request.get(pdfPageUrl, { timeout: 30000 })
      const body = await response.body()
      await context.close()

      if (!response.ok()) {
        log("PDF fetch failed for bill", billId, response.status())
        failed++
        continue
      }

      const contentType = response.headers()["content-type"] ?? "application/pdf"
      const isPdf = contentType.toLowerCase().includes("pdf") || pdfPageUrl.toLowerCase().includes(".pdf")
      if (body.length === 0) {
        log("Empty PDF response for bill", billId)
        failed++
        continue
      }

      const storagePath = `${UTILITY_KEY}/${billId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from(PDF_STORAGE_BUCKET)
        .upload(storagePath, body, {
          contentType: isPdf ? "application/pdf" : contentType,
          upsert: true,
        })

      if (uploadError) {
        log("Storage upload failed for bill", billId, uploadError.message)
        failed++
        continue
      }

      const { data: urlData } = supabase.storage.from(PDF_STORAGE_BUCKET).getPublicUrl(storagePath)
      const storedPdfUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from("utility_provider_bills")
        .update({
          pdf_url: storedPdfUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", billId)

      if (updateError) {
        log("Update failed for bill", billId, updateError.message)
        failed++
        continue
      }

      log("Stored PDF for bill", billId, storedPdfUrl.slice(0, 60) + "...")
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
