import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"

/**
 * GET /api/admin/utility-provider-bills
 * List utility_provider_bills (admin or manager). Manager sees only their properties.
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

    let query = supabase
      .from("utility_provider_bills")
      .select("id, property_id, utility_key, account_number, billing_period_start, billing_period_end, amount_due, due_date, pdf_url, fetched_at")
      .order("billing_period_start", { ascending: false })

    if (role === "manager") {
      const { data: propIds } = await supabase
        .from("properties")
        .select("id")
        .eq("manager_id", user.id)
      const ids = (propIds ?? []).map((p) => p.id)
      if (ids.length === 0) {
        return NextResponse.json({ data: [] })
      }
      query = query.in("property_id", ids)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/utility-provider-bills
 * Body: { property_id, utility_key?, account_number, billing_period_start, billing_period_end, amount_due, due_date?, pdf_url? }
 * Create one bill (admin or manager for their property). Use when scraper fails.
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
    const role = profile?.role
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const propertyId = body?.property_id
    const utilityKey = (body?.utility_key ?? "escondido_water") as string
    const accountNumber = String(body?.account_number ?? "").trim()
    const billingPeriodStart = body?.billing_period_start
    const billingPeriodEnd = body?.billing_period_end
    const amountDue = Number(body?.amount_due)
    const dueDate = body?.due_date ?? null
    const pdfUrl = body?.pdf_url ?? null

    if (!propertyId || !billingPeriodStart || !billingPeriodEnd) {
      return NextResponse.json(
        { error: "Missing property_id, billing_period_start, or billing_period_end" },
        { status: 400 }
      )
    }
    if (typeof amountDue !== "number" || Number.isNaN(amountDue) || amountDue < 0) {
      return NextResponse.json({ error: "amount_due must be a non-negative number" }, { status: 400 })
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

    const { error } = await supabase.from("utility_provider_bills").upsert(
      {
        property_id: propertyId,
        utility_key: utilityKey,
        account_number: accountNumber || "manual",
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        amount_due: amountDue,
        due_date: dueDate || null,
        pdf_url: pdfUrl || null,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "property_id,utility_key,billing_period_start",
        ignoreDuplicates: false,
      }
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
