import { NextRequest, NextResponse } from "next/server"
import { ingestEscondidoEmail, type EmailPayload } from "@/lib/escondido-email-ingest"

/**
 * POST /api/ingest/escondido-bill-email
 *
 * Accepts a bill notification email (JSON or form) and ingests it:
 * stores the email, extracts "View invoice or pay now" links, fetches invoice pages,
 * parses bill data, upserts utility_provider_bills with source_email_id and invoice_url.
 *
 * Body (JSON): { from, subject, date, html, text?, message_id? }
 * Or form (SendGrid/Mailgun): from, subject, html, text
 *
 * Secure with INGEST_ESCONDIDO_EMAIL_SECRET: Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_ESCONDIDO_EMAIL_SECRET
  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: EmailPayload
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    payload = (await request.json()) as EmailPayload
  } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData()
    const str = (key: string, alt?: string) => {
      const v = form.get(key) ?? (alt ? form.get(alt) : undefined)
      return typeof v === "string" ? v : undefined
    }
    payload = {
      from: str("from"),
      subject: str("subject"),
      date: str("date", "Received"),
      html: str("html", "body-html"),
      text: str("text", "body-plain"),
      message_id: str("Message-Id", "message_id"),
    }
  } else {
    return NextResponse.json(
      { error: "Content-Type must be application/json or multipart/form-data" },
      { status: 400 }
    )
  }

  const result = await ingestEscondidoEmail(payload)

  if (!result.ok && result.error) {
    const status = result.links_found === 0 && result.error === "Missing email body (html or text)" ? 400 : 500
    return NextResponse.json(
      { error: result.error, links_found: result.links_found, results: result.results },
      { status }
    )
  }

  if (result.links_found === 0 && result.results.length === 0) {
    return NextResponse.json(
      { error: "No invoice links found in email body", links_found: 0, results: [] },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    email_id: result.email_id,
    links_found: result.links_found,
    results: result.results,
  })
}
