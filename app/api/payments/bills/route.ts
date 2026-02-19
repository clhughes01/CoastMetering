import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/payments/bills
 * Returns bills with paid amount, amount owed, status, and who entered. Admin/manager only.
 * Query: ?manager=uuid (admin only) filters by that manager's entered bills.
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createSupabaseClientFromCookies()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const filterManagerId = searchParams.get("manager") || undefined
    const filterPropertyId = searchParams.get("property") || undefined

    let query = admin
      .from("bills")
      .select("id, account_number, resident_name, period_month, period_year, total_amount, due_date, created_at, created_by, property_id")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })

    if (profile.role === "manager") {
      query = query.eq("created_by", user.id)
    } else if (filterManagerId) {
      query = query.eq("created_by", filterManagerId)
    }
    if (filterPropertyId) {
      query = query.eq("property_id", filterPropertyId)
    }

    const { data: bills, error: billsError } = await query

    if (billsError) {
      console.error("Bills fetch error:", billsError)
      return NextResponse.json({ error: "Failed to load bills." }, { status: 500 })
    }

    const { data: paymentRecords, error: paymentsError } = await admin
      .from("payment_records")
      .select("bill_id, amount, paid_at, receipt_urls, notes, created_at")

    if (paymentsError) {
      console.error("Payment records fetch error:", paymentsError)
      return NextResponse.json({ error: "Failed to load payments." }, { status: 500 })
    }

    const paidByBill = (paymentRecords || []).reduce<Record<string, number>>((acc, pr) => {
      const id = pr.bill_id
      acc[id] = (acc[id] || 0) + Number(pr.amount)
      return acc
    }, {})

    const creatorIdsRaw = (bills || []).map((b) => (b as { created_by?: string | null }).created_by).filter((id): id is string => Boolean(id))
    const creatorIds = creatorIdsRaw.filter((id, i) => creatorIdsRaw.indexOf(id) === i)
    const creators: Record<string, string> = {}
    if (creatorIds.length > 0) {
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, name, email")
        .in("id", creatorIds)
      for (const p of profiles || []) {
        creators[p.id] = (p.name && p.name.trim()) ? p.name.trim() : (p.email || "")
      }
    }

    const propertyIdsRaw = (bills || []).map((b) => (b as { property_id?: string | null }).property_id).filter((id): id is string => Boolean(id))
    const propertyIds = propertyIdsRaw.filter((id, i) => propertyIdsRaw.indexOf(id) === i)
    const propertyLabels: Record<string, string> = {}
    if (propertyIds.length > 0) {
      const { data: properties } = await admin
        .from("properties")
        .select("id, address, city, state, zip_code")
        .in("id", propertyIds)
      for (const p of properties || []) {
        const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
        propertyLabels[p.id] = parts.join(", ") || p.id
      }
    }

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const rows = (bills || []).map((b) => {
      const total = Number(b.total_amount)
      const paid = paidByBill[b.id] || 0
      const owed = Math.max(0, total - paid)
      const status = owed <= 0 ? "fully_paid" : paid > 0 ? "partial" : "unpaid"
      const createdBy = (b as { created_by?: string | null }).created_by
      const propId = (b as { property_id?: string | null }).property_id
      return {
        id: b.id,
        accountNumber: b.account_number,
        residentName: b.resident_name,
        periodMonth: b.period_month,
        periodYear: b.period_year,
        periodLabel: `${MONTHS[b.period_month - 1]} ${b.period_year}`,
        totalAmount: total,
        amountPaid: paid,
        amountOwed: owed,
        status,
        dueDate: b.due_date,
        createdAt: b.created_at,
        enteredByName: createdBy ? (creators[createdBy] ?? null) : null,
        propertyId: propId || null,
        propertyLabel: propId ? (propertyLabels[propId] ?? null) : null,
      }
    })

    const totalBill = rows.reduce((s, r) => s + r.totalAmount, 0)
    const totalPaid = rows.reduce((s, r) => s + r.amountPaid, 0)
    const totalOwed = rows.reduce((s, r) => s + r.amountOwed, 0)

    return NextResponse.json({
      bills: rows,
      summary: { totalBill, totalPaid, totalOwed },
    })
  } catch (e) {
    console.error("Bills API error:", e)
    return NextResponse.json({ error: "An error occurred." }, { status: 500 })
  }
}

/**
 * POST /api/payments/bills
 * Create a new bill. Body: { accountNumber, residentName, periodMonth, periodYear, totalAmount, dueDate?, propertyId? }
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createSupabaseClientFromCookies()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { accountNumber, residentName, periodMonth, periodYear, totalAmount, dueDate, propertyId } = body as {
      accountNumber?: string
      residentName?: string
      periodMonth?: number
      periodYear?: number
      totalAmount?: number
      dueDate?: string
      propertyId?: string
    }

    if (!accountNumber?.trim() || !residentName?.trim() || periodMonth == null || periodYear == null || totalAmount == null) {
      return NextResponse.json(
        { error: "accountNumber, residentName, periodMonth, periodYear, and totalAmount are required." },
        { status: 400 }
      )
    }

    const { data: bill, error } = await admin
      .from("bills")
      .insert({
        account_number: accountNumber.trim(),
        resident_name: residentName.trim(),
        period_month: Number(periodMonth),
        period_year: Number(periodYear),
        total_amount: Number(totalAmount),
        due_date: dueDate || null,
        created_by: user.id,
        property_id: propertyId || null,
      })
      .select("id, account_number, resident_name, period_month, period_year, total_amount, due_date, created_at")
      .single()

    if (error) {
      console.error("Bill insert error:", error)
      return NextResponse.json({ error: "Failed to create bill." }, { status: 500 })
    }

    return NextResponse.json({ bill })
  } catch (e) {
    console.error("Create bill error:", e)
    return NextResponse.json({ error: "An error occurred." }, { status: 500 })
  }
}
