import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

const DEFAULT_UTILITY_KEY = "escondido_water"

/**
 * POST /api/admin/property-utility-accounts/import
 * Bulk import property → utility account mapping (e.g. Escondido).
 * Body: JSON { rows: [ { property_id, utility_key?, account_number } ] } or CSV text with columns:
 *   property_id,account_number,(optional)utility_key
 * Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseClientFromCookies()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const supabase = createSupabaseAdminClient()
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentType = request.headers.get("content-type") ?? ""
    let rows: { property_id: string; account_number: string; utility_key?: string }[] = []

    if (contentType.includes("application/json")) {
      const body = await request.json()
      const raw = body?.rows ?? body
      if (!Array.isArray(raw)) {
        return NextResponse.json(
          { error: "Body must be { rows: [ { property_id, account_number } ] }" },
          { status: 400 }
        )
      }
      for (const r of raw) {
        const property_id = r?.property_id ?? r?.propertyId
        const account_number = r?.account_number ?? r?.accountNumber
        const utility_key = r?.utility_key ?? r?.utilityKey
        if (typeof property_id === "string" && typeof account_number === "string") {
          rows.push({
            property_id: property_id.trim(),
            account_number: String(account_number).trim(),
            utility_key: typeof utility_key === "string" ? utility_key.trim() : undefined,
          })
        }
      }
    } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      const text = await request.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      if (lines.length < 2) {
        return NextResponse.json(
          { error: "CSV must have header row and at least one data row" },
          { status: 400 }
        )
      }
      const header = lines[0]!.toLowerCase().replace(/\s+/g, "_")
      const hasId = header.includes("property_id")
      const hasAccount = header.includes("account_number")
      if (!hasId || !hasAccount) {
        return NextResponse.json(
          { error: "CSV must have columns: property_id, account_number" },
          { status: 400 }
        )
      const idxId = header.split(",").map((h) => h.trim()).indexOf("property_id")
      const idxAccount = header.split(",").map((h) => h.trim()).indexOf("account_number")
      const idxUtility = header.split(",").map((h) => h.trim()).indexOf("utility_key")
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
        const property_id = cells[idxId]
        const account_number = cells[idxAccount]
        const utility_key = idxUtility >= 0 ? cells[idxUtility] : undefined
        if (property_id && account_number) {
          rows.push({ property_id, account_number, utility_key: utility_key || undefined })
        }
      }
    }
    } else {
      return NextResponse.json(
        { error: "Content-Type must be application/json or text/csv" },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows to import" }, { status: 400 })
    }

    const toInsert = rows.map(({ property_id, account_number, utility_key }) => ({
      property_id,
      utility_key: utility_key || DEFAULT_UTILITY_KEY,
      account_number,
    }))

    const { error } = await supabase
      .from("property_utility_accounts")
      .upsert(toInsert, { onConflict: "property_id,utility_key", ignoreDuplicates: false })

    if (error) {
      return NextResponse.json({ error: "Import failed", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, imported: toInsert.length })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    )
  }
}
