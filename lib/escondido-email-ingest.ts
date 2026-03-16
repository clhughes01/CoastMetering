import { createSupabaseAdminClient } from "@/lib/supabase/client"

const UTILITY_KEY = "escondido_water"

/** Log to console when ESCONDIDO_INGEST_DEBUG=1 (used by GitHub Actions / local debug) */
function debugLog(...args: unknown[]) {
  if (process.env.ESCONDIDO_INGEST_DEBUG === "1" || process.env.ESCONDIDO_INGEST_DEBUG === "true") {
    console.log("[escondido-ingest]", ...args)
  }
}
const INVOICE_DOMAIN = "invoicecloud.com"
const DOCUMENT_DOMAIN = "onlinebiller.com"

export type EmailPayload = {
  from?: string
  subject?: string
  date?: string
  html?: string
  text?: string
  message_id?: string
}

export type IngestResult = {
  ok: boolean
  email_id?: string
  links_found: number
  results: { url: string; bill_id?: string; error?: string }[]
  error?: string
}

/** Parsed account information from the email body (under "Account Information" etc.) and subject. Use as source of truth. */
export function parseAccountInfoFromEmail(
  html: string,
  text: string,
  subject?: string
): {
  accountNumber: string
  amountDue: number
  dueDate: string | null
  invoiceNumber: string
} {
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  const rawHtml = html || ""
  const plainText = text || ""
  const subj = subject || ""
  const combined = (stripTags(rawHtml) + " " + plainText + " " + subj).replace(/\s+/g, " ")

  let accountNumber = ""
  let amountDue = 0
  let dueDate: string | null = null
  let invoiceNumber = ""

  const normalizeDate = (s: string): string => {
    const parts = s.replace(/\//g, "-").split("-")
    if (parts.length !== 3) return s
    const [a, b, c] = parts
    const year = c!.length === 2 ? `20${c}` : c
    const month = a!.length === 1 ? `0${a}` : a
    const day = b!.length === 1 ? `0${b}` : b
    return `${year}-${month}-${day}`
  }

  // Account number — 10-digit Escondido account. Match "Account Number:" or "Account #" then digits. Try both HTML (with tags between label and value) and plain.
  const accountPatterns = [
    /Account\s*Number\s*:?\s*[\s<>\/\w"]*?(\d{10})\b/i,
    /Account\s*#\s*:?\s*[\s<>\/\w"]*?(\d{10})\b/i,
    /Account\s*number\s*:?\s*[\s<>\/\w"]*?(\d{8,12})\b/i,
    /Account\s*information[\s\S]{0,150}?(\d{10})\b/i,
    /Account\s*#\s*[:\s]*(\d{8,12})/i,
    /Account\s*number\s*[:\s]*(\d{8,12})/i,
    /(?:Account\s*#?|Account\s*number)[\s\S]{0,80}?(\d{10})\b/i,
  ]
  for (const re of accountPatterns) {
    const m = (rawHtml + " " + combined).match(re)
    if (m && m[1]) {
      accountNumber = m[1].trim()
      break
    }
  }

  // Balance due — look for label then $ amount (allow HTML between)
  const balancePatterns = [
    /Balance\s*Due\s*:?\s*[\s<>\/\w"]*?\$[\s]*([\d,]+\.?\d*)/i,
    /Amount\s*due\s*:?\s*[^$]{0,50}?\$[\s]*([\d,]+\.?\d*)/i,
    /(?:Balance\s*due|Amount\s*due|Total\s*due)\s*:?\s*[^$]{0,80}?\$[\s]*([\d,]+\.?\d*)/i,
  ]
  for (const re of balancePatterns) {
    const m = (rawHtml + " " + combined).match(re)
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(/,/g, ""))
      if (val > 0) {
        amountDue = val
        break
      }
    }
  }

  // Due date — "Invoice Due Date:" or "Due date" then date
  const duePatterns = [
    /Invoice\s*Due\s*Date\s*:?\s*[\s<>\/\w"]*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Due\s*date\s*:?\s*[\s<>\/\w"]*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Payment\s*due\s*[^0-9]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]
  for (const re of duePatterns) {
    const m = (rawHtml + " " + combined).match(re)
    if (m && m[1]) {
      dueDate = normalizeDate(m[1])
      break
    }
  }

  // Invoice number (from subject "Invoice# 340244031417" or body) — optional
  const invNumMatch = (subj + " " + combined).match(/Invoice\s*#?\s*(\d{9,12})/i) || combined.match(/Invoice\s*Number\s*:?\s*[\s<>\/\w"]*?(\d{8,12})\b/i)
  if (invNumMatch && invNumMatch[1]) invoiceNumber = invNumMatch[1].trim()

  return { accountNumber, amountDue, dueDate, invoiceNumber }
}

/** Extract the primary "View invoice or pay now" link from the email. Prefer the most specific URL (longest path or with invoice/portal in path). */
export function extractInvoiceLinks(html: string, text: string): string[] {
  const combined = html || text || ""
  const hrefRegex = /<a\s+([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
  const candidates: { url: string; primary: boolean; pathLength: number }[] = []
  let m: RegExpExecArray | null
  while ((m = hrefRegex.exec(combined)) !== null) {
    const url = m[2]!.trim()
    const inner = (m[4]! || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
    const isPrimary =
      inner.includes("view invoice") ||
      inner.includes("view invoice or pay") ||
      inner.includes("pay now") ||
      (inner.includes("invoice") && inner.includes("pay"))
    const isInvoiceCloud = url.includes(INVOICE_DOMAIN)
    const isDocLink = url.includes(DOCUMENT_DOMAIN)
    if (isInvoiceCloud || isDocLink) {
      if (isPrimary || url.includes("invoice") || url.includes("view") || url.includes("portal")) {
        try {
          const pathLength = new URL(url).pathname.length
          candidates.push({ url, primary: isPrimary || isDocLink, pathLength })
        } catch {
          candidates.push({ url, primary: isPrimary || isDocLink, pathLength: 0 })
        }
      }
    }
  }
  if (candidates.length === 0) {
    const fallbackRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi
    while ((m = fallbackRegex.exec(combined)) !== null) {
      const url = m[1]!.trim()
      if (url.includes(INVOICE_DOMAIN) && (url.includes("view") || url.includes("invoice") || url.includes("portal")))
        return [url]
      if (url.includes(DOCUMENT_DOMAIN)) return [url]
    }
    return []
  }
  // Prefer primary links, then longest path (most specific)
  candidates.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || b.pathLength - a.pathLength)
  return [candidates[0]!.url]
}

/** Find any direct PDF or document URL in the email body (e.g. docs.onlinebiller.com or .pdf link). */
export function extractDocumentLinkFromEmail(html: string, text: string): string | null {
  const combined = html || text || ""
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = hrefRegex.exec(combined)) !== null) {
    const url = m[1]!.trim()
    if (isValidDocumentUrl(url)) return url
  }
  const urlInText = combined.match(/(https?:\/\/[^\s<>"']*(?:onlinebiller\.com\/documents\.php[^\s<>"']*|\.pdf))/i)
  if (urlInText && urlInText[1] && isValidDocumentUrl(urlInText[1])) return urlInText[1]
  return null
}

/** Resolve href to absolute URL */
function resolveUrl(href: string, baseUrl: string): string {
  const s = href.trim()
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  try {
    return new URL(s, baseUrl).href
  } catch {
    return s
  }
}

/** Only allow URLs that are the actual bill document (docs.onlinebiller.com or PDF). Reject compliance, feed, rss, etc. */
function isValidDocumentUrl(url: string): boolean {
  const u = url.toLowerCase()
  if (u.includes("compliance.") || u.includes("/feed") || u.includes("rss") || u.includes(".xml") || u.includes("wordpress")) return false
  if (u.includes("onlinebiller.com") && u.includes("documents.php")) return true
  if (u.includes("onlinebiller.com")) return true
  if (u.endsWith(".pdf")) return true
  return false
}

/** Parse invoice page HTML for account number, amount, dates, and PDF link */
export function parseInvoicePage(html: string, pageUrl: string): {
  accountNumber: string
  amountDue: number
  dueDate: string | null
  periodStart: string
  periodEnd: string
  pdfUrl: string | null
} {
  const normalizeDate = (s: string): string => {
    const parts = s.replace(/\//g, "-").split("-")
    if (parts.length !== 3) return s
    const [a, b, c] = parts
    const year = c!.length === 2 ? `20${c}` : c
    const month = a!.length === 1 ? `0${a}` : a
    const day = b!.length === 1 ? `0${b}` : b
    return `${year}-${month}-${day}`
  }

  let accountNumber = ""
  let amountDue = 0
  let dueDate: string | null = null
  let periodStart = ""
  let periodEnd = ""

  // --- Summary page: labeled "Invoice number", "Account number", "Balance due", "Due date" (first page after View or pay invoice) ---
  // Account number: Escondido uses 10-digit (e.g. 3409446369). Prefer label-based patterns so we don't grab random numbers.
  const accountPatterns = [
    /(?:Account\s*#?|ACCOUNT\s*NUMBER|Account\s*number)[\s:]*<\/[^>]+>\s*<[^>]+>[\s]*(\d{8,12})/i,
    /(?:Account\s*#?|ACCOUNT\s*NUMBER)[^0-9]*(\d{8,12})/i,
    /Account\s*number\s*[:\s]*(?:<[^>]+>|\s)*(\d{8,12})/i,
    /account\s*#?\s*[:\s]*(\d{8,12})/i,
    /customer\s*account\s*[:\s#]*(?:<[^>]+>|\s)*(\d{8,12})/i,
    /(?:account|acct)\s*no\.?\s*[:\s]*(\d{8,12})/i,
    /(?:Account\s*#?|account\s*#?|ACCOUNT\s*NUMBER)[\s\S]{0,120}?(\d{10})\b/,
  ]
  for (const re of accountPatterns) {
    const m = html.match(re)
    if (m && m[1]) {
      accountNumber = m[1].trim()
      break
    }
  }
  if (!accountNumber) {
    const urlAccount = pageUrl.match(/account(?:number|id)?[=:](\d{8,12})/i) || pageUrl.match(/[?&]id=(\d{8,12})/)
    if (urlAccount) accountNumber = urlAccount[1]!.trim()
  }

  // Balance due / Amount due: use labeled value so we don't grab the first $ on the page (e.g. from header).
  const balanceDueMatch = html.match(/(?:Balance\s*due|Amount\s*due|Balance\s*due)[^$]*?\$[\s]*([\d,]+\.?\d*)/i)
  if (balanceDueMatch && balanceDueMatch[1]) {
    amountDue = parseFloat(balanceDueMatch[1].replace(/,/g, "")) || 0
  }
  if (amountDue <= 0) {
    const amountMatch = html.match(/\$[\s]*([\d,]+\.?\d*)/)
    if (amountMatch) amountDue = parseFloat(amountMatch[1].replace(/,/g, "")) || 0
  }

  // Due date: labeled "Due date" first
  const dueLabelMatch = html.match(/(?:Due\s*date|Due\s*Date)[^0-9]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
  if (dueLabelMatch) dueDate = normalizeDate(dueLabelMatch[1]!)
  const dateMatches = html.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g) || []
  if (dateMatches.length >= 1 && !periodStart) periodStart = normalizeDate(dateMatches[0]!)
  if (dateMatches.length >= 2 && !periodEnd) periodEnd = normalizeDate(dateMatches[1]!)
  if (!dueDate && dateMatches.length >= 3) dueDate = normalizeDate(dateMatches[2]!)
  if (!periodEnd && periodStart) periodEnd = periodStart

  // PDF / document link: On "Your Invoice" page the blue "View Invoice" link goes to the actual bill (often docs.onlinebiller.com).
  let pdfUrl: string | null = null

  // 1) Direct link to document host (docs.onlinebiller.com/documents.php) = the actual bill — only valid document URL
  const docHostRegex = new RegExp(`href=["'](https?://[^"']*${DOCUMENT_DOMAIN.replace(".", "\\.")}[^"']*)["']`, "gi")
  let docMatch = docHostRegex.exec(html)
  if (docMatch && docMatch[1]) {
    const u = docMatch[1].trim()
    if (isValidDocumentUrl(u)) pdfUrl = u
  }
  if (!pdfUrl) {
    const docUrlAnywhere = html.match(new RegExp(`(https?://[^"'\\s<>]*${DOCUMENT_DOMAIN.replace(".", "\\.")}[^"'\\s<>]*)`, "i"))
    if (docUrlAnywhere && docUrlAnywhere[1]) {
      const u = docUrlAnywhere[1].trim()
      if (isValidDocumentUrl(u)) pdfUrl = u
    }
  }

  // 2) "View Invoice" link on the summary page — this is the button/link that opens the actual bill. Prefer exact text "View Invoice".
  if (!pdfUrl) {
    const linkBlockRegex = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi
    let linkMatch: RegExpExecArray | null
    const candidates: { url: string; exact: boolean }[] = []
    while ((linkMatch = linkBlockRegex.exec(html)) !== null) {
      const attrs = linkMatch[1]!
      const inner = (linkMatch[2]! || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      if (/view\s*invoice|view\s*pdf|download\s*(?:pdf|bill)|print\s*invoice/i.test(inner)) {
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i)
        if (hrefMatch && hrefMatch[1]) {
          const raw = hrefMatch[1].trim()
          if (raw && !raw.startsWith("javascript:")) {
            const resolved = resolveUrl(raw, pageUrl)
            if (isValidDocumentUrl(resolved)) {
              pdfUrl = resolved
              break
            }
            if (resolved.includes("invoicecloud.com") && !resolved.includes("compliance") && !resolved.includes("/feed") && !resolved.includes("invoicecloud.net")) {
              candidates.push({ url: resolved, exact: /^view\s*invoice$/i.test(inner.trim()) })
            }
          }
        }
      }
    }
    if (!pdfUrl && candidates.length > 0) {
      const exact = candidates.find((c) => c.exact)
      pdfUrl = (exact || candidates[0])!.url
    }
  }
  // 2b) Form with submit "View Invoice" — action may point to bill or portal
  if (!pdfUrl) {
    const formRegex = /<form[^>]*action=["']([^"']+)["'][^>]*>[\s\S]*?View\s*Invoice[\s\S]*?<\/form>/gi
    const fm = formRegex.exec(html)
    if (fm && fm[1]) {
      const resolved = resolveUrl(fm[1].trim(), pageUrl)
      if (isValidDocumentUrl(resolved)) pdfUrl = resolved
      else if (resolved.includes("invoicecloud.com") && !resolved.includes("compliance") && !resolved.includes("/feed")) pdfUrl = resolved
    }
  }

  // 3) JavaScript: only accept onlinebiller.com document URL, never compliance/feed
  if (!pdfUrl) {
    const jsDocUrl = html.match(new RegExp(`["'](https?://[^"']*${DOCUMENT_DOMAIN.replace(".", "\\.")}[^"']*)["']`, "i"))
    if (jsDocUrl && jsDocUrl[1]) {
      const u = jsDocUrl[1].trim()
      if (isValidDocumentUrl(u)) pdfUrl = u
    }
  }
  if (!pdfUrl) {
    const pdfHrefPatterns = [
      /<a\s+[^>]*href=["']([^"']*\.pdf[^"']*)["']/i,
      /href=["']([^"']*(?:documents\.php|download\.aspx|pdf\.aspx|getpdf|viewpdf)[^"']*)["']/i,
    ]
    for (const re of pdfHrefPatterns) {
      const match = html.match(re)
      if (match && match[1]) {
        const resolved = resolveUrl(match[1].trim(), pageUrl)
        if (isValidDocumentUrl(resolved)) {
          pdfUrl = resolved
          break
        }
      }
    }
  }

  // 4) data-url / data-href only if valid document
  if (!pdfUrl) {
    const dataUrlMatch = html.match(/data-(?:pdf-)?(?:url|href)=["']([^"']+)["']/i)
    if (dataUrlMatch && dataUrlMatch[1]) {
      const resolved = resolveUrl(dataUrlMatch[1].trim(), pageUrl)
      if (isValidDocumentUrl(resolved)) pdfUrl = resolved
    }
  }

  // 5) Form action only if valid document
  if (!pdfUrl) {
    const formMatch = html.match(/<form[^>]*action=["']([^"']*(?:pdf|documents\.php)[^"']*)["']/i)
    if (formMatch && formMatch[1]) {
      const resolved = resolveUrl(formMatch[1].trim(), pageUrl)
      if (isValidDocumentUrl(resolved)) pdfUrl = resolved
    }
  }

  debugLog("parseInvoicePage", { pageUrl: pageUrl.slice(0, 80), accountNumber: accountNumber || "(none)", amountDue, dueDate, pdfUrl: pdfUrl ? pdfUrl.slice(0, 80) : null })
  return { accountNumber, amountDue, dueDate, periodStart, periodEnd, pdfUrl }
}

/**
 * Ingest one Escondido bill notification email: store email, extract invoice links,
 * fetch each invoice page, parse bill data, upsert bills with source_email_id and invoice_url.
 */
export async function ingestEscondidoEmail(payload: EmailPayload): Promise<IngestResult> {
  const html = payload.html ?? ""
  const text = payload.text ?? ""
  if (!html && !text) {
    return { ok: false, links_found: 0, results: [], error: "Missing email body (html or text)" }
  }

  const links = extractInvoiceLinks(html, text)
  debugLog("extractInvoiceLinks", links.length, links[0] ?? "(none)")

  const emailInfo = parseAccountInfoFromEmail(html, text, payload.subject)
  debugLog("email account info", {
    accountNumber: emailInfo.accountNumber || "(none)",
    amountDue: emailInfo.amountDue,
    dueDate: emailInfo.dueDate ?? "(none)",
    invoiceNumber: emailInfo.invoiceNumber || "(none)",
  })

  if (links.length === 0) {
    return { ok: true, links_found: 0, results: [] }
  }

  const invoiceUrl = links[0]!
  const supabase = createSupabaseAdminClient()

  const messageId = payload.message_id ?? `ingest-${Date.now()}-${payload.subject ?? "no-subject"}`
  const { data: existingEmail } = await supabase
    .from("utility_bill_emails")
    .select("id")
    .eq("message_id", messageId)
    .single()

  let emailId: string
  if (existingEmail) {
    emailId = existingEmail.id
  } else {
    const { data: newEmail, error: emailError } = await supabase
      .from("utility_bill_emails")
      .insert({
        message_id: messageId,
        subject: payload.subject ?? null,
        from_address: payload.from ?? null,
        received_at: payload.date ? new Date(payload.date).toISOString() : null,
        body_plain: text.slice(0, 50000) || null,
        body_html: html.slice(0, 100000) || null,
      })
      .select("id")
      .single()
    if (emailError) {
      return { ok: false, links_found: links.length, results: [], error: emailError.message }
    }
    emailId = newEmail!.id
  }

  const { data: accountRows } = await supabase
    .from("property_utility_accounts")
    .select("property_id, account_number")
    .eq("utility_key", UTILITY_KEY)
  const accountToProperty = new Map<string, string>()
  for (const row of accountRows || []) {
    accountToProperty.set(String(row.account_number).trim(), row.property_id)
  }
  const defaultPropertyId = accountRows?.length === 1 ? accountRows![0].property_id : null
  const defaultAccount = accountRows?.length === 1 ? accountRows![0].account_number : null

  const accountNumber = emailInfo.accountNumber || (defaultAccount ?? "unknown")
  const propertyId = accountToProperty.get(accountNumber) ?? defaultPropertyId ?? null

  const dueDate = emailInfo.dueDate || null
  const periodEnd = dueDate || new Date().toISOString().slice(0, 10)
  const periodStart = dueDate
    ? (() => {
        const [y, m] = periodEnd.split("-")
        const d = new Date(parseInt(y!, 10), parseInt(m!, 10) - 2, 1)
        return d.toISOString().slice(0, 10)
      })()
    : periodEnd

  const billRow = {
    property_id: propertyId,
    utility_key: UTILITY_KEY,
    account_number: accountNumber,
    invoice_number: emailInfo.invoiceNumber || null,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    amount_due: emailInfo.amountDue >= 0 ? emailInfo.amountDue : 0,
    due_date: dueDate,
    pdf_url: null,
    external_id: invoiceUrl.slice(0, 500),
    invoice_url: invoiceUrl,
    source_email_id: emailId,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  debugLog("bill row (email only)", { account_number: accountNumber, invoice_number: billRow.invoice_number, due_date: dueDate, invoice_url: invoiceUrl.slice(0, 80) })

  let bill: { id: string } | null = null
  let upsertError: { message: string } | null = null

  if (propertyId) {
    const out = await supabase
      .from("utility_provider_bills")
      .upsert(billRow, { onConflict: "property_id,utility_key,billing_period_start", ignoreDuplicates: false })
      .select("id")
      .single()
    upsertError = out.error
    bill = out.data
  } else {
    const { data: existing } = await supabase
      .from("utility_provider_bills")
      .select("id")
      .eq("utility_key", UTILITY_KEY)
      .eq("account_number", accountNumber)
      .eq("billing_period_start", periodStart)
      .is("property_id", null)
      .maybeSingle()
    if (existing) {
      const out = await supabase.from("utility_provider_bills").update(billRow).eq("id", existing.id).select("id").single()
      upsertError = out.error
      bill = out.data
    } else {
      const out = await supabase.from("utility_provider_bills").insert(billRow).select("id").single()
      upsertError = out.error
      bill = out.data
    }
  }

  const results: { url: string; bill_id?: string; error?: string }[] = []
  if (upsertError) {
    results.push({ url: invoiceUrl, error: upsertError.message })
    debugLog("bill upsert error", upsertError.message)
  } else {
    results.push({ url: invoiceUrl, bill_id: bill?.id ?? undefined })
    debugLog("bill saved", { bill_id: bill?.id, account_number: accountNumber })
  }

  return { ok: true, email_id: emailId, links_found: links.length, results }
}
