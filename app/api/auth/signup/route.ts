import { createSupabaseAdminClient } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/signup
 * Body: { email, firstName, lastName, code }
 * Sends an invite email via Supabase. The user is created only when they click
 * the link in the email (no account until then). They then set their password on our site.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, code } = body as {
      email?: string
      firstName?: string
      lastName?: string
      code?: string
    }

    const trimmedCode = typeof code === "string" ? code.trim().toUpperCase() : ""
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    const trimmedFirst = typeof firstName === "string" ? firstName.trim() : ""
    const trimmedLast = typeof lastName === "string" ? lastName.trim() : ""

    if (!trimmedEmail || !trimmedCode) {
      return NextResponse.json(
        { error: "Email and invite code are required." },
        { status: 400 }
      )
    }
    if (!trimmedFirst || !trimmedLast) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      )
    }

    const admin = createSupabaseAdminClient()

    const { data: codeRow, error: codeError } = await admin
      .from("invite_codes")
      .select("id, role, expires_at, used_at")
      .eq("code", trimmedCode)
      .single()

    if (codeError || !codeRow) {
      return NextResponse.json(
        { error: "Invalid or expired invite code. Please request a new one." },
        { status: 400 }
      )
    }
    if (codeRow.used_at) {
      return NextResponse.json(
        { error: "This invite code has already been used." },
        { status: 400 }
      )
    }
    const expiresAt = new Date(codeRow.expires_at)
    if (expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "This invite code has expired. Please request a new one." },
        { status: 400 }
      )
    }

    const { data: existing } = await admin.from("user_profiles").select("id").eq("email", trimmedEmail).single()
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 400 }
      )
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://coast-metering.vercel.app"
    const redirectTo = `${baseUrl}/auth/confirm`

    const fullName = `${trimmedFirst} ${trimmedLast}`.trim()
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
      data: {
        role: codeRow.role,
        name: fullName,
      },
      redirectTo,
    })

    if (inviteError) {
      const msg = inviteError.message.toLowerCase()
      if (msg.includes("already") || msg.includes("exists")) {
        return NextResponse.json(
          { error: "An account with this email already exists or an invite was already sent. Please sign in or check your email." },
          { status: 400 }
        )
      }
      console.error("Invite error:", inviteError)
      return NextResponse.json(
        { error: inviteError.message || "Failed to send invite." },
        { status: 500 }
      )
    }

    await admin
      .from("invite_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", codeRow.id)

    return NextResponse.json({
      success: true,
      message: "Check your email for an invite link (the email will be from Supabase). Click the link to create your account and set your password. If you don't see it, check your spam or junk folder.",
    })
  } catch (e) {
    console.error("Signup error:", e)
    return NextResponse.json(
      { error: "An error occurred during sign up." },
      { status: 500 }
    )
  }
}
