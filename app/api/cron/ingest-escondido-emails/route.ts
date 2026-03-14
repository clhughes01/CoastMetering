import { NextRequest, NextResponse } from "next/server"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { createSupabaseAdminClient } from "@/lib/supabase/client"
import { ingestEscondidoEmail, type EmailPayload } from "@/lib/escondido-email-ingest"

const CRON_SECRET = process.env.CRON_SECRET
const IMAP_HOST = process.env.ESCONDIDO_IMAP_HOST?.trim()
const IMAP_USER = process.env.ESCONDIDO_IMAP_USER?.trim()
const IMAP_PASSWORD = process.env.ESCONDIDO_IMAP_PASSWORD?.trim()
const IMAP_PORT = parseInt(process.env.ESCONDIDO_IMAP_PORT ?? "993", 10)
const IMAP_TLS = process.env.ESCONDIDO_IMAP_TLS !== "false"
const MAX_EMAILS_PER_RUN = parseInt(process.env.ESCONDIDO_IMAP_MAX_EMAILS ?? "50", 10)
const DAYS_BACK = parseInt(process.env.ESCONDIDO_IMAP_DAYS_BACK ?? "7", 10)

/** Comma-separated addresses that may forward bill emails (e.g. coastmetering@gmail.com) */
const ALLOWED_FORWARDERS = (process.env.ESCONDIDO_IMAP_ALLOWED_FORWARDERS ?? "coastmetering@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/** Sender addresses we consider Escondido/Invoice Cloud bill notifications (or allowed forwarders) */
function isBillSender(from: string): boolean {
  const lower = from.toLowerCase()
  if (ALLOWED_FORWARDERS.some((allowed) => lower.includes(allowed))) return true
  return (
    lower.includes("invoicecloud") ||
    lower.includes("escondido") ||
    (lower.includes("noreply@") && (lower.includes("bill") || lower.includes("invoice") || lower.includes("water")))
  )
}

/**
 * GET /api/cron/ingest-escondido-emails
 *
 * Runs on a schedule (e.g. daily). Connects to the configured IMAP inbox,
 * fetches recent emails from Invoice Cloud / Escondido, and ingests each
 * (stores email + extracts invoice links → fetches invoice pages → upserts bills).
 *
 * Env: CRON_SECRET, ESCONDIDO_IMAP_HOST, ESCONDIDO_IMAP_USER, ESCONDIDO_IMAP_PASSWORD
 * Optional: ESCONDIDO_IMAP_PORT (993), ESCONDIDO_IMAP_TLS (true), ESCONDIDO_IMAP_MAX_EMAILS (20), ESCONDIDO_IMAP_DAYS_BACK (7)
 *
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const querySecret = request.nextUrl.searchParams.get("secret")
  const provided = bearer ?? querySecret ?? ""

  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
    return NextResponse.json(
      {
        error: "Missing IMAP config",
        env: "Set ESCONDIDO_IMAP_HOST, ESCONDIDO_IMAP_USER, ESCONDIDO_IMAP_PASSWORD",
      },
      { status: 400 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - DAYS_BACK)

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_TLS,
    auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
  })

  const processed: { subject: string; message_id: string; bills: number; error?: string }[] = []
  let totalBills = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock("INBOX")
    try {
      const uidsRaw = await client.search({ since: sinceDate }, { uid: true })
      const uids = Array.isArray(uidsRaw) ? uidsRaw : []
      // Fetch the most recent emails (highest UIDs = newest); older slice would miss recent bill forwards
      const uidsToFetch = uids.length <= MAX_EMAILS_PER_RUN ? uids : uids.slice(-MAX_EMAILS_PER_RUN)
      const messages = await client.fetchAll(uidsToFetch, {
        envelope: true,
        source: true,
      }, { uid: true })

      let count = 0
      for (const message of messages) {
        if (count >= MAX_EMAILS_PER_RUN) break
        const from = message.envelope?.from?.[0]?.address ?? ""
        if (!isBillSender(from)) continue

        const messageId = (typeof message.envelope?.messageId === "string"
          ? message.envelope.messageId
          : message.envelope?.messageId?.[0]) ?? ""
        if (messageId) {
          const { data: existing } = await supabase
            .from("utility_bill_emails")
            .select("id")
            .eq("message_id", messageId)
            .single()
          if (existing) continue
        }

        const raw = message.source
        if (!raw || !(raw instanceof Buffer)) continue

        let payload: EmailPayload
        try {
          const parsed = await simpleParser(raw)
          payload = {
            from: parsed.from?.text ?? "",
            subject: parsed.subject ?? "",
            date: parsed.date ? new Date(parsed.date).toISOString() : undefined,
            html: typeof parsed.html === "string" ? parsed.html : undefined,
            text: typeof parsed.text === "string" ? parsed.text : undefined,
            message_id: parsed.messageId ?? undefined,
          }
        } catch (parseErr) {
          processed.push({
            subject: message.envelope?.subject ?? "",
            message_id: messageId,
            bills: 0,
            error: parseErr instanceof Error ? parseErr.message : "Parse failed",
          })
          continue
        }

        const result = await ingestEscondidoEmail(payload)
        const billsCreated = result.results.filter((r) => r.bill_id).length
        totalBills += billsCreated
        processed.push({
          subject: payload.subject ?? "",
          message_id: payload.message_id ?? "",
          bills: billsCreated,
          error: result.error,
        })
        count++
      }
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const authFailed =
      message.includes("AUTHENTICATIONFAILED") ||
      (err as { authenticationFailed?: boolean }).authenticationFailed
    const body: Record<string, unknown> = {
      ok: false,
      error: message,
      processed: processed.length,
      totalBills,
    }
    if (authFailed) {
      body.debug = {
        imap_user_length: IMAP_USER?.length ?? 0,
        imap_password_length: IMAP_PASSWORD?.length ?? 0,
        hint: "Password must be 16 chars (Gmail App Password). If length is wrong, re-paste in Vercel with no spaces/newlines.",
      }
    }
    return NextResponse.json(body, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    totalBills,
    details: processed,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
