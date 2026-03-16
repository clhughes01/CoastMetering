/**
 * Escondido bill email ingest — runnable from GitHub Actions or locally.
 *
 * Connects to IMAP, fetches recent bill emails, ingests each (extract link → fetch
 * invoice page → parse account/amount/pdf URL → upsert bill).
 *
 * Set ESCONDIDO_INGEST_DEBUG=1 for detailed step-by-step logs.
 * Set DEBUG_OUTPUT_FILE to a path to also write logs there (e.g. for GA artifact).
 *
 * Env: ESCONDIDO_IMAP_HOST, ESCONDIDO_IMAP_USER, ESCONDIDO_IMAP_PASSWORD,
 *      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { createSupabaseAdminClient } from "@/lib/supabase/client"
import { ingestEscondidoEmail, type EmailPayload } from "@/lib/escondido-email-ingest"
import * as fs from "fs"

const DEBUG = process.env.ESCONDIDO_INGEST_DEBUG === "1" || process.env.ESCONDIDO_INGEST_DEBUG === "true"
const DEBUG_OUTPUT_FILE = process.env.DEBUG_OUTPUT_FILE?.trim()

const IMAP_HOST = process.env.ESCONDIDO_IMAP_HOST?.trim()
const IMAP_USER = process.env.ESCONDIDO_IMAP_USER?.trim()
const IMAP_PASSWORD = process.env.ESCONDIDO_IMAP_PASSWORD?.trim()
const IMAP_PORT = parseInt(process.env.ESCONDIDO_IMAP_PORT ?? "993", 10)
const IMAP_TLS = process.env.ESCONDIDO_IMAP_TLS !== "false"
const MAX_EMAILS_PER_RUN = parseInt(process.env.ESCONDIDO_IMAP_MAX_EMAILS ?? "50", 10)
const DAYS_BACK = parseInt(process.env.ESCONDIDO_IMAP_DAYS_BACK ?? "7", 10)

const ALLOWED_FORWARDERS = (process.env.ESCONDIDO_IMAP_ALLOWED_FORWARDERS ?? "coastmetering@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

function isBillSender(from: string): boolean {
  const lower = from.toLowerCase()
  if (ALLOWED_FORWARDERS.some((allowed) => lower.includes(allowed))) return true
  return (
    lower.includes("invoicecloud") ||
    lower.includes("escondido") ||
    (lower.includes("noreply@") && (lower.includes("bill") || lower.includes("invoice") || lower.includes("water")))
  )
}

const logLines: string[] = []

function log(...args: unknown[]) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")
  console.log(...args)
  if (DEBUG_OUTPUT_FILE) logLines.push(`${new Date().toISOString()} ${line}`)
}

async function main() {
  log("run-escondido-email-ingest start")
  if (DEBUG) log("ESCONDIDO_INGEST_DEBUG=1 — watch debug enabled")

  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
    log("Missing IMAP config. Set ESCONDIDO_IMAP_HOST, ESCONDIDO_IMAP_USER, ESCONDIDO_IMAP_PASSWORD")
    process.exit(1)
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
    log("Connecting to IMAP", IMAP_HOST)
    await client.connect()
    const lock = await client.getMailboxLock("INBOX")
    try {
      const uidsRaw = await client.search({ since: sinceDate }, { uid: true })
      const uids = Array.isArray(uidsRaw) ? uidsRaw : []
      const uidsToFetch = uids.length <= MAX_EMAILS_PER_RUN ? uids : uids.slice(-MAX_EMAILS_PER_RUN)
      log("Emails in range:", uids.length, "fetching up to", uidsToFetch.length)

      const messages = await client.fetchAll(uidsToFetch, { envelope: true, source: true }, { uid: true })

      let count = 0
      for (const message of messages) {
        if (count >= MAX_EMAILS_PER_RUN) break
        const from = message.envelope?.from?.[0]?.address ?? ""
        if (!isBillSender(from)) continue

        const messageId =
          (typeof message.envelope?.messageId === "string"
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
          log("Parse failed for message:", (parseErr as Error).message)
          processed.push({
            subject: message.envelope?.subject ?? "",
            message_id: messageId,
            bills: 0,
            error: parseErr instanceof Error ? parseErr.message : "Parse failed",
          })
          continue
        }

        if (DEBUG) log("Processing email:", payload.subject?.slice(0, 60), "from", payload.from?.slice(0, 40))

        const result = await ingestEscondidoEmail(payload)
        const billsCreated = result.results.filter((r) => r.bill_id).length
        totalBills += billsCreated

        if (DEBUG) {
          log("Ingest result:", result.links_found, "links, bills created:", billsCreated)
          result.results.forEach((r, i) => log("  result", i, r.bill_id ? `bill_id=${r.bill_id}` : `error=${r.error}`))
        }

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
    log("IMAP error:", message)
    if (DEBUG && err instanceof Error && err.stack) log(err.stack)
    process.exit(1)
  }

  log("Done. Processed:", processed.length, "emails, total bills created/updated:", totalBills)
  processed.forEach((p, i) => log(" ", i + 1, p.subject?.slice(0, 50), "bills:", p.bills, p.error ?? ""))

  if (DEBUG_OUTPUT_FILE && logLines.length > 0) {
    fs.writeFileSync(DEBUG_OUTPUT_FILE, logLines.join("\n"), "utf8")
    log("Wrote debug log to", DEBUG_OUTPUT_FILE)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
