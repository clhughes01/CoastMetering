/**
 * Bulk import property → Escondido account number mapping from a CSV file.
 * One command loads hundreds of properties; no manual SQL per property.
 *
 * Usage:
 *   npx tsx scripts/import-property-utility-accounts.ts path/to/file.csv
 *   npm run import-utility-accounts -- path/to/file.csv
 *
 * CSV format (first row = header):
 *
 *   Option A - by property ID:
 *     property_id,account_number
 *     a1b2c3d4-e5f6-7890-abcd-ef1234567890,12345678
 *     b2c3d4e5-f6a7-8901-bcde-f12345678901,87654321
 *
 *   Option B - by address (script looks up property_id):
 *     address,city,state,zip_code,account_number
 *     123 Main St,Escondido,CA,92025,12345678
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

const UTILITY_KEY = "escondido_water"
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

function parseCsvLine(line: string): string[] {
  return line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""))
}

function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"))
  const rows = lines.slice(1).map((l) => parseCsvLine(l))
  return { headers, rows }
}

function rowToRecord(row: string[], headers: string[]): Record<string, string> {
  const rec: Record<string, string> = {}
  headers.forEach((h, i) => {
    rec[h] = row[i]?.trim() ?? ""
  })
  return rec
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-property-utility-accounts.ts <path/to/file.csv>")
    console.error("")
    console.error("CSV formats:")
    console.error("  property_id,account_number")
    console.error("  address,city,state,zip_code,account_number")
    process.exit(1)
  }

  const resolved = resolve(process.cwd(), filePath)
  let content: string
  try {
    content = readFileSync(resolved, "utf-8")
  } catch (e) {
    console.error("Could not read file:", resolved, e)
    process.exit(1)
  }

  const { headers, rows } = parseCsv(content)
  if (headers.length === 0 || rows.length === 0) {
    console.error("CSV must have a header row and at least one data row.")
    process.exit(1)
  }

  const supabase = getSupabase()

  const byId = headers.includes("property_id") && headers.includes("account_number")
  const byAddress =
    headers.includes("address") &&
    headers.includes("city") &&
    headers.includes("state") &&
    headers.includes("zip_code") &&
    headers.includes("account_number")

  if (!byId && !byAddress) {
    console.error(
      "CSV must have either (property_id, account_number) or (address, city, state, zip_code, account_number)."
    )
    process.exit(1)
  }

  let propertyIds: { property_id: string; account_number: string }[] = []

  if (byId) {
    for (const row of rows) {
      const r = rowToRecord(row, headers)
      const property_id = r.property_id ?? ""
      const account_number = r.account_number ?? ""
      if (!property_id || !account_number) continue
      if (!UUID_REGEX.test(property_id)) {
        console.warn("Skipping row: invalid property_id", property_id)
        continue
      }
      propertyIds.push({ property_id, account_number })
    }
  } else {
    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip_code")
    if (error) {
      console.error("Failed to load properties:", error.message)
      process.exit(1)
    }
    const byAddr = new Map(
      (properties || []).map((p) => {
        const key = [
          (p.address ?? "").trim().toLowerCase(),
          (p.city ?? "").trim().toLowerCase(),
          (p.state ?? "").trim().toLowerCase(),
          (p.zip_code ?? "").trim(),
        ].join("|")
        return [key, p.id] as const
      })
    )
    for (const row of rows) {
      const r = rowToRecord(row, headers)
      const address = (r.address ?? "").trim().toLowerCase()
      const city = (r.city ?? "").trim().toLowerCase()
      const state = (r.state ?? "").trim().toLowerCase()
      const zip_code = (r.zip_code ?? "").trim()
      const account_number = (r.account_number ?? "").trim()
      if (!account_number) continue
      const key = [address, city, state, zip_code].join("|")
      const property_id = byAddr.get(key)
      if (!property_id) {
        console.warn("No property found for address:", address, city, state, zip_code)
        continue
      }
      propertyIds.push({ property_id, account_number })
    }
  }

  if (propertyIds.length === 0) {
    console.error("No valid rows to import.")
    process.exit(1)
  }

  const toInsert = propertyIds.map(({ property_id, account_number }) => ({
    property_id,
    utility_key: UTILITY_KEY,
    account_number,
  }))

  const { data, error } = await supabase
    .from("property_utility_accounts")
    .upsert(toInsert, { onConflict: "property_id,utility_key", ignoreDuplicates: false })

  if (error) {
    console.error("Insert failed:", error.message)
    process.exit(1)
  }

  console.log(`Imported ${toInsert.length} property → account mapping(s) for ${UTILITY_KEY}.`)
}

main()
