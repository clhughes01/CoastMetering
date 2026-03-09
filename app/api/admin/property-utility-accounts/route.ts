import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"

/**
 * GET /api/admin/property-utility-accounts?property_id=xxx
 * Returns utility account mappings for one property (for Edit Property UI).
 * Admin or manager (manager only for their properties).
 */
export async function GET(request: NextRequest) {
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
    const role = profile?.role
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const propertyId = request.nextUrl.searchParams.get("property_id")
    if (!propertyId) {
      return NextResponse.json({ error: "Missing property_id" }, { status: 400 })
    }

    if (role === "manager") {
      const { data: prop } = await supabase
        .from("properties")
        .select("manager_id")
        .eq("id", propertyId)
        .single()
      if (!prop || (prop.manager_id != null && prop.manager_id !== user.id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const { data, error } = await supabase
      .from("property_utility_accounts")
      .select("utility_key, account_number")
      .eq("property_id", propertyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/property-utility-accounts
 * Body: { property_id, utility_key, account_number }
 * Upsert one mapping. If account_number is empty string or null, delete the row.
 * Admin or manager (manager only for their properties).
 */
export async function PUT(request: NextRequest) {
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
    const role = profile?.role
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const propertyId = body?.property_id
    const utilityKey = body?.utility_key ?? "escondido_water"
    const accountNumber = body?.account_number?.trim() ?? ""

    if (!propertyId) {
      return NextResponse.json({ error: "Missing property_id" }, { status: 400 })
    }

    if (role === "manager") {
      const { data: prop } = await supabase
        .from("properties")
        .select("manager_id")
        .eq("id", propertyId)
        .single()
      if (!prop || (prop.manager_id != null && prop.manager_id !== user.id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    if (!accountNumber) {
      await supabase
        .from("property_utility_accounts")
        .delete()
        .eq("property_id", propertyId)
        .eq("utility_key", utilityKey)
      return NextResponse.json({ success: true, deleted: true })
    }

    const { error } = await supabase
      .from("property_utility_accounts")
      .upsert(
        { property_id: propertyId, utility_key: utilityKey, account_number: accountNumber },
        { onConflict: "property_id,utility_key" }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    )
  }
}
