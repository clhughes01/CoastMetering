import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

const BUCKET = "payment-receipts"

/**
 * DELETE /api/payments/bills/[billId]
 * Remove a bill and all its payments. Receipt files in storage are deleted.
 * Managers can only delete bills they created (created_by = user.id).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
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

    const { billId } = await params
    if (!billId) {
      return NextResponse.json({ error: "Bill ID required." }, { status: 400 })
    }

    const { data: bill, error: billErr } = await admin
      .from("bills")
      .select("id, created_by")
      .eq("id", billId)
      .single()

    if (billErr || !bill) {
      return NextResponse.json({ error: "Bill not found." }, { status: 404 })
    }

    if (profile.role === "manager" && (bill as { created_by?: string | null }).created_by !== user.id) {
      return NextResponse.json({ error: "You can only remove bills you entered." }, { status: 403 })
    }

    const { data: payments } = await admin
      .from("payment_records")
      .select("id, receipt_urls")
      .eq("bill_id", billId)

    for (const p of payments || []) {
      const urls = (p.receipt_urls as string[]) || []
      for (const url of urls) {
        try {
          const parts = url.split(`/${BUCKET}/`)
          const path = parts[1]
          if (path) await admin.storage.from(BUCKET).remove([path])
        } catch {
          // ignore storage cleanup errors
        }
      }
    }

    const { error: deleteErr } = await admin
      .from("bills")
      .delete()
      .eq("id", billId)

    if (deleteErr) {
      console.error("Delete bill error:", deleteErr)
      return NextResponse.json({ error: "Failed to remove bill." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Delete bill error:", e)
    return NextResponse.json({ error: "An error occurred." }, { status: 500 })
  }
}
