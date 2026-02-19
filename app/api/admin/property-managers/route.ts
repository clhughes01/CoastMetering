import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

/** Shape of a property row when selected with units and tenants */
type PropertyWithUnits = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  manager_id?: string | null
  units?: Array<{
    id: string
    unit_number: string
    tenants: Array<{
      id: string
      name: string
      email: string | null
      move_out_date: string | null
    }>
  }> | null
}

/**
 * GET /api/admin/property-managers
 * Returns all users with role 'manager' and for each, the properties they manage (manager_id = user id).
 * Admin-only.
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
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: managers, error: managersError } = await supabase
      .from("user_profiles")
      .select("id, email, name, company_name, phone")
      .eq("role", "manager")
      .order("name", { ascending: true })

    if (managersError) {
      console.error("Error fetching managers:", managersError)
      return NextResponse.json(
        { error: "Failed to fetch managers", details: managersError.message },
        { status: 500 }
      )
    }

    const { data: properties, error: propsError } = await supabase
      .from("properties")
      .select(`
        id,
        address,
        city,
        state,
        zip_code,
        manager_id,
        units (
          id,
          unit_number,
          tenants (
            id,
            name,
            email,
            move_out_date
          )
        )
      `)
      .order("address", { ascending: true })

    if (propsError) {
      console.error("Error fetching properties:", propsError)
      return NextResponse.json(
        { error: "Failed to fetch properties", details: propsError.message },
        { status: 500 }
      )
    }

    const propertyList = (properties || []) as PropertyWithUnits[]
    const propertiesByManager = propertyList.reduce(
      (acc: Record<string, PropertyWithUnits[]>, p) => {
        const mid = p.manager_id ?? "_unassigned"
        if (!acc[mid]) acc[mid] = []
        acc[mid].push(p)
        return acc
      },
      {} as Record<string, PropertyWithUnits[]>
    )

    const result = (managers || []).map((m) => ({
      ...m,
      properties: propertiesByManager[m.id] || [],
    }))

    return NextResponse.json({
      success: true,
      data: result,
      unassignedProperties: propertiesByManager["_unassigned"] || [],
    })
  } catch (error) {
    console.error("Error in property-managers API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
