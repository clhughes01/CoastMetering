import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

/**
 * PATCH /api/admin/properties/[propertyId]/manager
 * Body: { managerId: string | null }
 * Sets properties.manager_id for the given property.
 * Admin: can assign any manager (or unassign). Property Manager: can only assign themselves.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    if (!propertyId) {
      return NextResponse.json({ error: "Property ID is required" }, { status: 400 })
    }

    let body: { managerId?: string | null }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const rawManagerId = body.managerId
    const managerId =
      rawManagerId === undefined
        ? undefined
        : rawManagerId === null || rawManagerId === ""
          ? null
          : String(rawManagerId).trim() || null

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
    if (role === "manager") {
      if (managerId !== null && managerId !== user.id) {
        return NextResponse.json(
          { error: "Property Managers can only assign properties to themselves" },
          { status: 403 }
        )
      }
    }

    if (managerId) {
      const { data: managerProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", managerId)
        .eq("role", "manager")
        .single()
      if (!managerProfile) {
        return NextResponse.json(
          { error: "Invalid manager: user not found or not a manager" },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from("properties")
      .update({ manager_id: managerId ?? null })
      .eq("id", propertyId)
      .select("id, manager_id")
      .single()

    if (error) {
      console.error("Error updating Property Manager:", error)
      return NextResponse.json(
        { error: "Failed to update property", details: error.message },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error in PATCH Property Manager:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
