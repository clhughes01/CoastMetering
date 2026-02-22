import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

function randomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = ""
  const bytes = new Uint8Array(length)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  }
  for (let i = 0; i < length; i++) result += chars[bytes[i]! % chars.length]
  return result
}

/**
 * POST /api/invite-codes/generate
 * Body: { role: 'tenant' | 'manager' }
 * Admin can generate for tenant or manager. Manager can generate for tenant only.
 * Code expires in 24 hours.
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
    const requestedRole = body.role
    const role =
      requestedRole === "manager"
        ? "manager"
        : requestedRole === "landlord"
          ? "landlord"
          : "tenant"

    if (profile.role === "manager" && role !== "tenant" && role !== "landlord") {
      return NextResponse.json(
        { error: "Property Managers can only generate tenant or landlord invite codes." },
        { status: 403 }
      )
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    let code = randomCode(8)
    let exists = true
    let attempts = 0
    while (exists && attempts < 10) {
      const { data: existing } = await admin
        .from("invite_codes")
        .select("id")
        .eq("code", code)
        .single()
      exists = !!existing
      if (exists) code = randomCode(8)
      attempts++
    }

    const { data: row, error: insertError } = await admin
      .from("invite_codes")
      .insert({
        code,
        role,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, code, role, expires_at")
      .single()

    if (insertError) {
      console.error("Invite code insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to generate code." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      code: row.code,
      role: row.role,
      expiresAt: row.expires_at,
      message: "Code expires in 24 hours. Share it with the person who will sign up.",
    })
  } catch (e) {
    console.error("Generate invite code error:", e)
    return NextResponse.json(
      { error: "An error occurred." },
      { status: 500 }
    )
  }
}
