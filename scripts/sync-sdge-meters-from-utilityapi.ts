/**
 * Sync SDG&E UtilityAPI meter UIDs into property_sdge_utilityapi_meters by matching
 * UtilityAPI meter "base" identifiers to property_utility_accounts.account_number
 * where utility_key = 'sdge_electric'.
 *
 * Run after customers have authorized SDG&E in UtilityAPI and you have stored each
 * property's SDG&E account / SAID in property_utility_accounts (no manual meter_uid typing).
 *
 * Env: UTILITYAPI_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SDGE_SYNC_DEBUG=1
 */
import "dotenv/config"
import { createSupabaseAdminClient } from "@/lib/supabase/client"

const UTILITY_KEY = "sdge_electric"
const UTILITY_API_ID = "SDG&E" // UtilityAPI Utility ID for SDG&E

const TOKEN = process.env.UTILITYAPI_TOKEN?.trim()
const DEBUG = process.env.SDGE_SYNC_DEBUG === "1" || process.env.SDGE_SYNC_DEBUG === "true"

function log(...args: unknown[]) {
  console.log("[sdge-meter-sync]", ...args)
}

function normAccount(s: string): string {
  return s.replace(/\s+/g, "").replace(/-/g, "").toLowerCase()
}

/** Possible account / SAID forms we match against UtilityAPI base fields. */
function accountVariants(raw: string): Set<string> {
  const set = new Set<string>()
  const t = raw.trim()
  if (!t) return set
  set.add(normAccount(t))
  const digits = t.replace(/\D/g, "")
  if (digits.length >= 6) set.add(digits)
  const noUnderscore = t.replace(/_gas/gi, "").trim()
  if (noUnderscore !== t) set.add(normAccount(noUnderscore))
  return set
}

async function utilityApiGetJson<T>(url: string): Promise<T> {
  if (!TOKEN) throw new Error("Missing UTILITYAPI_TOKEN")
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "User-Agent": "CoastMetering/1.0 (sdge-meter-sync)",
    },
  })
  if (res.status === 202) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "10", 10)
    const waitMs = Math.min(60000, Math.max(2000, retryAfter * 1000))
    log("UtilityAPI 202, waiting", waitMs, "ms")
    await new Promise((r) => setTimeout(r, waitMs))
    return await utilityApiGetJson<T>(url)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`UtilityAPI ${res.status}: ${text.slice(0, 400)}`)
  }
  return (await res.json()) as T
}

type MeterListing = { meters: any[]; next: string | null }

function extractMatchKeys(meter: any): string[] {
  const keys: string[] = []
  const base = meter?.base
  if (base && typeof base === "object") {
    for (const k of ["billing_account", "service_identifier"]) {
      const v = base[k]
      if (typeof v === "string" && v.trim()) {
        keys.push(v.trim())
        const beforeDash = v.split("-")[0]?.trim()
        if (beforeDash && beforeDash !== v.trim()) keys.push(beforeDash)
      }
    }
    const nums = base.meter_numbers
    if (Array.isArray(nums)) {
      for (const n of nums) {
        if (typeof n === "string" && n.trim()) keys.push(n.trim())
      }
    }
  }
  return keys
}

function meterMatchesProperty(accountRaw: string, meter: any): boolean {
  const want = accountVariants(accountRaw)
  if (want.size === 0) return false
  for (const key of extractMatchKeys(meter)) {
    for (const part of key.split(/[\s,]+/)) {
      if (!part) continue
      for (const v of Array.from(accountVariants(part))) {
        if (want.has(v)) return true
      }
    }
  }
  return false
}

async function fetchAllSdgeElectricMeters(): Promise<any[]> {
  const utilityParam = encodeURIComponent(UTILITY_API_ID)
  let url =
    `https://utilityapi.com/api/v2/meters?utility=${utilityParam}&service_type=electric&is_archived=false&expand_meter_blocks=true`
  const out: any[] = []
  for (let page = 0; page < 100 && url; page++) {
    const listing = await utilityApiGetJson<MeterListing>(url)
    out.push(...(listing.meters ?? []))
    url = listing.next ?? ""
    if (DEBUG) log("page", page + 1, "meters:", listing.meters?.length ?? 0, "next:", url ? "yes" : "no")
  }
  return out
}

/**
 * Avoid PostgREST upsert + onConflict: production DBs differ (renamed table has a triple
 * unique; fresh CREATE has only (property_id, meter_uid)). GitHub Actions does not apply
 * migrations, so we match on property_id + meter_uid and update or insert.
 */
async function upsertSdgeMeterMapping(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  property_id: string,
  meter_uid: string
): Promise<{ error: Error | null }> {
  const updated_at = new Date().toISOString()
  const { data: existing, error: selErr } = await supabase
    .from("property_sdge_utilityapi_meters")
    .select("id")
    .eq("property_id", property_id)
    .eq("meter_uid", meter_uid)
    .maybeSingle()

  if (selErr) return { error: new Error(selErr.message) }

  if (existing?.id) {
    const { error } = await supabase
      .from("property_sdge_utilityapi_meters")
      .update({ utility_key: UTILITY_KEY, updated_at })
      .eq("id", existing.id)
    return { error: error ? new Error(error.message) : null }
  }

  const { error } = await supabase.from("property_sdge_utilityapi_meters").insert({
    property_id,
    utility_key: UTILITY_KEY,
    meter_uid,
    updated_at,
  })
  return { error: error ? new Error(error.message) : null }
}

async function main() {
  const supabase = createSupabaseAdminClient()

  const { data: mappings, error: mapErr } = await supabase
    .from("property_utility_accounts")
    .select("property_id, account_number")
    .eq("utility_key", UTILITY_KEY)

  if (mapErr) throw new Error(mapErr.message)
  let rows = (mappings ?? []) as { property_id: string; account_number: string }[]

  const { data: propRows, error: propErr } = await supabase.from("properties").select("id")
  if (propErr) throw new Error(propErr.message)
  const validIds = new Set((propRows ?? []).map((p: { id: string }) => p.id))
  const before = rows.length
  rows = rows.filter((r) => validIds.has(r.property_id))
  if (before > rows.length) {
    log("Ignored", before - rows.length, "utility account row(s) for missing/deleted properties.")
  }

  if (rows.length === 0) {
    log("No property_utility_accounts rows for", UTILITY_KEY, "that belong to a property in our database.")
    log("Add SDG&E account numbers per property (Admin → property utility accounts), then re-run.")
    return
  }

  log("Loading SDG&E electric meters from UtilityAPI...")
  const meters = await fetchAllSdgeElectricMeters()
  log("UtilityAPI returned", meters.length, "electric meter(s) for SDG&E")

  let inserted = 0
  let skipped = 0

  for (const { property_id, account_number } of rows) {
    const matches = meters.filter((m) => meterMatchesProperty(account_number, m))
    if (matches.length === 0) {
      if (DEBUG) log("No UtilityAPI meter matched account", account_number, "property", property_id.slice(0, 8))
      skipped++
      continue
    }
    if (matches.length > 1 && DEBUG) {
      log("Multiple meters matched account", account_number, "— linking all", matches.length)
    }
    for (const m of matches) {
      const uid = String(m?.uid ?? "").trim()
      if (!uid) continue
      const { error } = await upsertSdgeMeterMapping(supabase, property_id, uid)
      if (error) {
        log("Upsert failed", property_id, uid, error.message)
      } else {
        inserted++
      }
    }
  }

  log("Done. Upserts:", inserted, "properties with no match:", skipped)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
