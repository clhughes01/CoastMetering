import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

/**
 * GET /api/tenants/list
 * Returns tenants (active only, no move_out_date) with unit and property info,
 * scoped by role: admin = all, manager = their + unassigned properties, landlord = their properties.
 * Shape matches Customer for use on Tenants/customers pages.
 */
export async function GET() {
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
    if (role !== "admin" && role !== "manager" && role !== "landlord") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: tenants, error } = await supabase
      .from("tenants")
      .select(`
        id,
        name,
        email,
        phone,
        account_number,
        unit:units (
          id,
          unit_number,
          property:properties (
            id,
            address,
            city,
            state,
            zip_code,
            owner_name,
            manager_id,
            landlord_id
          )
        )
      `)
      .is("move_out_date", null)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching tenants:", error)
      return NextResponse.json(
        { error: "Failed to fetch tenants", details: error.message },
        { status: 500 }
      )
    }

    let list = (tenants || []) as any[]
    if (role === "manager") {
      list = list.filter(
        (t) =>
          t.unit?.property &&
          (t.unit.property.manager_id === user.id || t.unit.property.manager_id == null)
      )
    } else if (role === "landlord") {
      list = list.filter(
        (t) => t.unit?.property && t.unit.property.landlord_id === user.id
      )
    }

    const data = list.map((tenant: any, index: number) => ({
      id: index + 1,
      accountNumber: tenant.account_number || `100${index + 1}`,
      residentName: tenant.name,
      unit: `Unit ${tenant.unit?.unit_number ?? "N/A"}`,
      streetAddress: tenant.unit?.property?.address ?? "N/A",
      city:
        tenant.unit?.property?.city && tenant.unit?.property?.state
          ? `${tenant.unit.property.city}, ${tenant.unit.property.state}`
          : "N/A",
      zipCode: tenant.unit?.property?.zip_code ?? "N/A",
      email: tenant.email ?? "",
      phone: tenant.phone ?? "",
      landlordName: tenant.unit?.property?.owner_name ?? "N/A",
      propertyId: tenant.unit?.property?.id,
      userId: tenant.id,
      tenantId: tenant.id,
      unitId: tenant.unit?.id,
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("Error in tenants list API:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
