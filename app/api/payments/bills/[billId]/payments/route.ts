import { createSupabaseAdminClient, createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

const BUCKET = "payment-receipts"

/**
 * GET /api/payments/bills/[billId]/payments
 * List payment records for a bill (for showing history + receipt links).
 */
export async function GET(
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

    const { data: payments, error } = await admin
      .from("payment_records")
      .select("id, amount, paid_at, receipt_urls, notes, created_at")
      .eq("bill_id", billId)
      .order("paid_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to load payments." }, { status: 500 })
    }

    return NextResponse.json({ payments: payments || [] })
  } catch (e) {
    console.error("Get payments error:", e)
    return NextResponse.json({ error: "An error occurred." }, { status: 500 })
  }
}

/**
 * POST /api/payments/bills/[billId]/payments
 * Add a payment (full or partial) to a bill. Optional receipt image(s).
 * Body: multipart/form-data with amount (required), notes (optional), receipt (optional file(s))
 */
export async function POST(
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

    const formData = await request.formData()
    const amountStr = formData.get("amount")?.toString()
    const notes = formData.get("notes")?.toString()?.trim() || null
    const amount = amountStr ? parseFloat(amountStr) : NaN
    if (!amountStr || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required." }, { status: 400 })
    }

    const { data: bill, error: billErr } = await admin
      .from("bills")
      .select("id")
      .eq("id", billId)
      .single()
    if (billErr || !bill) {
      return NextResponse.json({ error: "Bill not found." }, { status: 404 })
    }

    const receiptUrls: string[] = []
    const files = formData.getAll("receipt") as File[]
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file || !(file instanceof File) || file.size === 0) continue
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${billId}/${Date.now()}-${i}.${ext}`
      const { data: upload, error: uploadErr } = await admin.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) {
        console.error("Receipt upload error:", uploadErr)
        continue
      }
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(upload.path)
      receiptUrls.push(urlData.publicUrl)
    }

    const { data: payment, error: insertErr } = await admin
      .from("payment_records")
      .insert({
        bill_id: billId,
        amount,
        paid_at: new Date().toISOString(),
        receipt_urls: receiptUrls.length ? receiptUrls : [],
        notes,
      })
      .select("id, bill_id, amount, paid_at, receipt_urls, notes, created_at")
      .single()

    if (insertErr) {
      console.error("Payment record insert error:", insertErr)
      return NextResponse.json({ error: "Failed to record payment." }, { status: 500 })
    }

    return NextResponse.json({ payment })
  } catch (e) {
    console.error("Add payment error:", e)
    return NextResponse.json({ error: "An error occurred." }, { status: 500 })
  }
}
