import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

const BUCKET = "payment-receipts"

/**
 * DELETE /api/payments/bills/[billId]/payments/[paymentId]
 * Remove a payment (e.g. entered by mistake). Admin/manager only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string; paymentId: string }> }
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

    const { billId, paymentId } = await params
    if (!billId || !paymentId) {
      return NextResponse.json({ error: "Bill ID and payment ID required." }, { status: 400 })
    }

    const { data: payment, error: fetchErr } = await admin
      .from("payment_records")
      .select("id, receipt_urls")
      .eq("id", paymentId)
      .eq("bill_id", billId)
      .single()

    if (fetchErr || !payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 })
    }

    const { error: deleteErr } = await admin
      .from("payment_records")
      .delete()
      .eq("id", paymentId)
      .eq("bill_id", billId)

    if (deleteErr) {
      console.error("Delete payment error:", deleteErr)
      return NextResponse.json({ error: "Failed to remove payment." }, { status: 500 })
    }

    const urls = (payment.receipt_urls as string[]) || []
    for (const url of urls) {
      try {
        const parts = url.split(`/${BUCKET}/`)
        const path = parts[1]
        if (path) await admin.storage.from(BUCKET).remove([path])
      } catch {
        // ignore storage cleanup errors
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Delete payment error:", e)
    return NextResponse.json({ error: "An error occurred." }, { status: 500 })
  }
}
