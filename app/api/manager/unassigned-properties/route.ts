import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

/**
 * GET /api/manager/unassigned-properties
 * Returns properties with no manager (manager_id is null). Manager role only.
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
    if (profile?.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip_code")
      .is("manager_id", null)
      .order("address", { ascending: true })

    if (error) {
      console.error("Error fetching unassigned properties:", error)
      return NextResponse.json(
        { error: "Failed to fetch properties", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: properties || [] })
  } catch (error) {
    console.error("Error in unassigned-properties API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
