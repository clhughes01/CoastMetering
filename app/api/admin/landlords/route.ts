import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

type PropertyWithUnits = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  landlord_id?: string | null
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
 * GET /api/admin/landlords
 * Returns all users with role 'landlord' and their assigned properties,
 * plus properties with no landlord. Admin or Property Manager.
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
    if (profile?.role !== "admin" && profile?.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: landlords, error: landlordsError } = await supabase
      .from("user_profiles")
      .select("id, email, name, phone")
      .eq("role", "landlord")
      .order("name", { ascending: true })

    if (landlordsError) {
      console.error("Error fetching landlords:", landlordsError)
      return NextResponse.json(
        { error: "Failed to fetch landlords", details: landlordsError.message },
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
        landlord_id,
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
    const byLandlord = propertyList.reduce(
      (acc: Record<string, PropertyWithUnits[]>, p) => {
        const lid = p.landlord_id ?? "_unassigned"
        if (!acc[lid]) acc[lid] = []
        acc[lid].push(p)
        return acc
      },
      {} as Record<string, PropertyWithUnits[]>
    )

    const result = (landlords || []).map((l) => ({
      ...l,
      properties: byLandlord[l.id] || [],
    }))

    return NextResponse.json({
      success: true,
      data: result,
      unassignedProperties: byLandlord["_unassigned"] || [],
    })
  } catch (error) {
    console.error("Error in landlords API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
