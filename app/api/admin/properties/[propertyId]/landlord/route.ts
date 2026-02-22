import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

/**
 * PATCH /api/admin/properties/[propertyId]/landlord
 * Body: { landlordId: string | null }
 * Sets properties.landlord_id. Admin or Property Manager.
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

    let body: { landlordId?: string | null }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const rawLandlordId = body.landlordId
    const landlordId =
      rawLandlordId === undefined || rawLandlordId === null || rawLandlordId === ""
        ? null
        : String(rawLandlordId).trim() || null

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

    if (landlordId) {
      const { data: landlordProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", landlordId)
        .eq("role", "landlord")
        .single()
      if (!landlordProfile) {
        return NextResponse.json(
          { error: "Invalid landlord: user not found or not a landlord" },
          { status: 400 }
        )
      }
    }

    if (profile.role === "manager") {
      const { data: property } = await supabase
        .from("properties")
        .select("id, manager_id")
        .eq("id", propertyId)
        .single()
      if (!property || property.manager_id !== user.id) {
        return NextResponse.json(
          { error: "You can only assign or unassign landlords for properties you manage" },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabase
      .from("properties")
      .update({ landlord_id: landlordId })
      .eq("id", propertyId)
      .select("id, landlord_id")
      .single()

    if (error) {
      console.error("Error updating landlord:", error)
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
    console.error("Error in PATCH landlord:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
