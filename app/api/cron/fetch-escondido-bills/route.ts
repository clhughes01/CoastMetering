import { NextRequest, NextResponse } from "next/server"

/**
 * Cron or manual trigger for fetching Escondido Water bills.
 * Playwright cannot run inside Vercel serverless, so this route either:
 * 1. Calls BILL_FETCH_WEBHOOK_URL (your worker that runs the script), or
 * 2. Returns instructions to run the script on a scheduler.
 *
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const querySecret = request.nextUrl.searchParams.get("secret")
  const provided = bearer ?? querySecret ?? ""

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const webhookUrl = process.env.BILL_FETCH_WEBHOOK_URL
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "cron", source: "coast-metering" }),
      })
      const text = await res.text()
      return NextResponse.json({
        ok: res.ok,
        status: res.status,
        message: "Webhook called",
        response: text.slice(0, 500),
      })
    } catch (err) {
      return NextResponse.json(
        { error: "Webhook request failed", details: String(err) },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({
    message:
      "Escondido bill fetch runs via a separate script (Playwright cannot run in Vercel). Run on a schedule: npx tsx scripts/fetch-escondido-bills.ts",
    env: {
      set: [
        "ESCONDIDO_LOGIN_EMAIL",
        "ESCONDIDO_LOGIN_PASSWORD",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
      ],
      optional: [
        "ESCONDIDO_PROPERTY_ACCOUNTS (JSON: propertyId -> accountNumber)",
        "BILL_FETCH_WEBHOOK_URL (POST here to trigger your worker)",
      ],
    },
    tables: [
      "property_utility_accounts (map property_id to utility account_number)",
      "utility_provider_bills (fetched bills are inserted here)",
    ],
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
