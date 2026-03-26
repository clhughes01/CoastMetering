/**
 * SDG&E electric bill fetcher via UtilityAPI.
 *
 * Runs on a schedule (GitHub Actions). For each mapped UtilityAPI meter uid,
 * pulls recent bills, downloads each bill PDF, uploads it to Supabase Storage,
 * and upserts into utility_provider_bills under utility_key = 'sdge_electric'.
 *
 * Env:
 *   UTILITYAPI_TOKEN (UtilityAPI API token)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   SDGE_BILLS_DAYS_BACK (default 60)
 *   SDGE_UTILITYAPI_METERS_JSON (fallback mapping when DB table empty):
 *     JSON array: [{ "property_id": "...", "meter_uid": "123" }, ...]
 *   SDGE_BILLS_DEBUG=1, DEBUG_OUTPUT_FILE
 */
import "dotenv/config"

import { createSupabaseAdminClient } from "@/lib/supabase/client"
import * as fs from "fs"

const UTILITY_KEY = "sdge_electric"
const PDF_STORAGE_BUCKET = "utility-bill-pdfs"

const TOKEN = process.env.UTILITYAPI_TOKEN?.trim()
const DAYS_BACK = Math.max(1, parseInt(process.env.SDGE_BILLS_DAYS_BACK ?? "60", 10))
const DEBUG = process.env.SDGE_BILLS_DEBUG === "1" || process.env.SDGE_BILLS_DEBUG === "true"
const DEBUG_OUTPUT_FILE = process.env.DEBUG_OUTPUT_FILE?.trim()

type MeterMapRow = { property_id: string; meter_uid: string }

const logLines: string[] = []
function log(...args: unknown[]) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")
  console.log("[sdge-utilityapi]", ...args)
  if (DEBUG_OUTPUT_FILE) logLines.push(`${new Date().toISOString()} [sdge-utilityapi] ${line}`)
}

function writeDebugLog() {
  if (!DEBUG_OUTPUT_FILE) return
  try {
    fs.writeFileSync(DEBUG_OUTPUT_FILE, logLines.join("\n"), "utf8")
    console.log("Wrote debug log to", DEBUG_OUTPUT_FILE)
  } catch (e) {
    console.error("Failed to write debug log:", e)
  }
}

function toDateOnly(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null
  // UtilityAPI returns ISO8601 timestamps; we store YYYY-MM-DD
  const m = isoOrDate.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

async function utilityApiGetJson<T>(url: string): Promise<T> {
  if (!TOKEN) throw new Error("Missing UTILITYAPI_TOKEN")
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "CoastMetering/1.0 (sdge-utilityapi)",
      Accept: "application/json",
    },
  })
  if (res.status === 202) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "10", 10)
    const waitMs = Math.min(60000, Math.max(2000, retryAfter * 1000))
    log("UtilityAPI 202 cache building. Waiting", waitMs, "ms then retrying...")
    await new Promise((r) => setTimeout(r, waitMs))
    return await utilityApiGetJson<T>(url)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`UtilityAPI error ${res.status}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

async function utilityApiGetBinary(url: string): Promise<{ body: Uint8Array; contentType: string }> {
  if (!TOKEN) throw new Error("Missing UTILITYAPI_TOKEN")
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "CoastMetering/1.0 (sdge-utilityapi)",
      Accept: "*/*",
    },
  })
  if (res.status === 202) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "10", 10)
    const waitMs = Math.min(60000, Math.max(2000, retryAfter * 1000))
    log("UtilityAPI 202 (file) building. Waiting", waitMs, "ms then retrying...")
    await new Promise((r) => setTimeout(r, waitMs))
    return await utilityApiGetBinary(url)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`UtilityAPI file error ${res.status}: ${text.slice(0, 200)}`)
  }
  const contentType = res.headers.get("content-type") ?? "application/pdf"
  const ab = await res.arrayBuffer()
  return { body: new Uint8Array(ab), contentType }
}

async function ensureBucket(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === PDF_STORAGE_BUCKET)) return
  const { error } = await supabase.storage.createBucket(PDF_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: 15 * 1024 * 1024, // 15MB
  })
  if (error) log("Bucket create failed (may already exist):", error.message)
}

async function loadMeterMappings(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<MeterMapRow[]> {
  const { data, error } = await supabase
    .from("property_utilityapi_meters")
    .select("property_id, meter_uid")
    .eq("utility_key", UTILITY_KEY)
  if (error) throw new Error(`Failed to load property_utilityapi_meters: ${error.message}`)
  const rows = (data ?? []) as MeterMapRow[]
  if (rows.length > 0) return rows

  const fallback = process.env.SDGE_UTILITYAPI_METERS_JSON?.trim()
  if (!fallback) return []
  try {
    const parsed = JSON.parse(fallback) as MeterMapRow[]
    return (parsed || [])
      .filter((r) => typeof r?.property_id === "string" && typeof r?.meter_uid === "string")
      .map((r) => ({ property_id: r.property_id.trim(), meter_uid: String(r.meter_uid).trim() }))
  } catch {
    log("SDGE_UTILITYAPI_METERS_JSON is not valid JSON; ignoring")
    return []
  }
}

async function main() {
  const supabase = createSupabaseAdminClient()
  await ensureBucket(supabase)

  const mappings = await loadMeterMappings(supabase)
  if (mappings.length === 0) {
    log("No SDG&E UtilityAPI meter mappings found. Add rows to property_utilityapi_meters (utility_key=sdge_electric).")
    return
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - DAYS_BACK)
  const start = startDate.toISOString().slice(0, 10)
  const end = new Date().toISOString().slice(0, 10)
  log("Fetching SDG&E bills from UtilityAPI. meters:", mappings.length, "range:", start, "→", end)

  let upserted = 0
  let downloaded = 0
  let failed = 0

  for (const map of mappings) {
    const meterUid = map.meter_uid
    const propertyId = map.property_id
    try {
      // Bills listing can paginate; follow `next` until null.
      let url = `https://utilityapi.com/api/v2/bills?meters=${encodeURIComponent(meterUid)}&start=${start}&end=${end}&order=earliest_first&limit=1000`
      for (let page = 0; page < 50 && url; page++) {
        const listing = await utilityApiGetJson<{ bills: any[]; next: string | null }>(url)
        const bills = listing.bills ?? []
        if (DEBUG) log("meter", meterUid, "bills:", bills.length, "next:", listing.next ? "yes" : "no")

        for (const b of bills) {
          const billUid = String(b?.uid ?? "").trim()
          if (!billUid) continue

          // Base bill fields vary; we rely on common timestamp keys and fall back conservatively.
          const periodStart = toDateOnly(b?.start) || toDateOnly(b?.start_date) || toDateOnly(b?.billing_start) || null
          const periodEnd = toDateOnly(b?.end) || toDateOnly(b?.end_date) || toDateOnly(b?.billing_end) || periodStart
          const dueDate = toDateOnly(b?.due) || toDateOnly(b?.due_date) || null
          const amountDue =
            typeof b?.amount === "number"
              ? b.amount
              : typeof b?.total === "number"
                ? b.total
                : typeof b?.amount_due === "number"
                  ? b.amount_due
                  : 0

          if (!periodStart || !periodEnd) {
            // We need a billing period for our unique constraint; skip if missing.
            if (DEBUG) log("Skipping bill missing period dates", billUid)
            continue
          }

          // Download PDF from UtilityAPI files endpoint and store.
          const pdfFileUrl = `https://utilityapi.com/api/v2/files/pdf_bill?uid=${encodeURIComponent(billUid)}`
          let storedPdfUrl: string | null = null
          try {
            const pdf = await utilityApiGetBinary(pdfFileUrl)
            const storagePath = `${UTILITY_KEY}/${billUid}.pdf`
            const { error: uploadError } = await supabase.storage
              .from(PDF_STORAGE_BUCKET)
              .upload(storagePath, pdf.body, {
                contentType: pdf.contentType.includes("pdf") ? "application/pdf" : pdf.contentType,
                upsert: true,
              })
            if (uploadError) throw new Error(uploadError.message)
            const { data: urlData } = supabase.storage.from(PDF_STORAGE_BUCKET).getPublicUrl(storagePath)
            storedPdfUrl = urlData.publicUrl
            downloaded++
          } catch (e) {
            // Still upsert bill even if PDF fails; we can retry later.
            log("PDF download/upload failed for bill", billUid, e instanceof Error ? e.message : String(e))
          }

          const externalId = `utilityapi:bill:${billUid}`.slice(0, 500)

          const { error: upsertError } = await supabase.from("utility_provider_bills").upsert(
            {
              property_id: propertyId,
              utility_key: UTILITY_KEY,
              account_number: meterUid, // store meter uid as account_number for traceability
              billing_period_start: periodStart,
              billing_period_end: periodEnd,
              amount_due: amountDue >= 0 ? amountDue : 0,
              due_date: dueDate,
              external_id: externalId,
              pdf_url: storedPdfUrl,
              fetched_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "property_id,utility_key,billing_period_start", ignoreDuplicates: false }
          )

          if (upsertError) {
            failed++
            log("Upsert failed for bill", billUid, upsertError.message)
          } else {
            upserted++
          }
        }

        url = listing.next ?? ""
      }
    } catch (e) {
      failed++
      log("Meter fetch failed", meterUid, e instanceof Error ? e.message : String(e))
    }
  }

  log("Done. upserted:", upserted, "pdfs stored:", downloaded, "failed:", failed)
}

main()
  .catch((e) => {
    console.error(e)
    writeDebugLog()
    process.exit(1)
  })
  .finally(() => writeDebugLog())

