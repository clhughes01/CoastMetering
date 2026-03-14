import { createSupabaseAdminClient } from "@/lib/supabase/client"

const UTILITY_KEY = "escondido_water"
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

/** Extract the single primary "View invoice or pay now" link from the email. Returns at most one URL so we create one bill per email. */
export function extractInvoiceLinks(html: string, text: string): string[] {
  const combined = html || text || ""
  const hrefRegex = /<a\s+([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = hrefRegex.exec(combined)) !== null) {
    const url = m[2]!.trim()
    const beforeRight = (m[1]! + m[3]!).replace(/\s+/g, " ")
    const inner = (m[4]! || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    const linkText = (beforeRight + " " + inner).toLowerCase()
    const isPrimary =
      linkText.includes("view invoice") ||
      linkText.includes("view invoice or pay") ||
      linkText.includes("pay now") ||
      (linkText.includes("invoice") && linkText.includes("pay"))
    const isInvoiceCloud = url.includes(INVOICE_DOMAIN)
    const isDocLink = url.includes(DOCUMENT_DOMAIN)
    if ((isInvoiceCloud || isDocLink) && (isPrimary || url.includes("invoice") || url.includes("view"))) {
      if (isPrimary || isDocLink) return [url]
    }
  }
  const fallbackRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi
  while ((m = fallbackRegex.exec(combined)) !== null) {
    const url = m[1]!.trim()
    if (url.includes(INVOICE_DOMAIN) && (url.includes("view") || url.includes("invoice") || url.includes("portal"))) {
      return [url]
    }
    if (url.includes(DOCUMENT_DOMAIN)) return [url]
  }
  return []
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

  // Account number: Escondido uses 10-digit account numbers (e.g. 3409446369). Require 8+ digits so we never capture years (2025) or short IDs.
  const accountPatterns = [
    /ACCOUNT\s*NUMBER[^0-9]*(\d{8,12})/i,
    /ACCOUNT\s*#?\s*[:\s]*(\d{8,12})/i,
    /Account\s*#?\s*[:\s]*(?:<[^>]+>|\s)*(\d{8,12})/i,
    /Account\s*number\s*[:\s]*(?:<[^>]+>|\s)*(\d{8,12})/i,
    /account\s*#?\s*[:\s]*(\d{8,12})/i,
    /account\s*number\s*[:\s]*(\d{8,12})/i,
    /customer\s*account\s*[:\s#]*(?:<[^>]+>|\s)*(\d{8,12})/i,
    /(?:account|acct)\s*no\.?\s*[:\s]*(\d{8,12})/i,
    /\bAccount\s*#\s*[:\s]*(\d{8,12})/i,
    /(?:^|[>\s])#\s*(\d{8,12})\b/,
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
  if (!accountNumber) {
    const inTable = html.match(/Account\s*#?[^<]*<\/[^>]+>\s*<[^>]+>[^<]*(\d{8,12})/i)
    if (inTable && inTable[1]) accountNumber = inTable[1].trim()
  }

  const amountMatch = html.match(/\$[\d,]+\.?\d*/)
  if (amountMatch) amountDue = parseFloat(amountMatch[0].replace(/[$,]/g, "")) || 0

  const dateMatches = html.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g) || []
  if (dateMatches.length >= 1) periodStart = normalizeDate(dateMatches[0]!)
  if (dateMatches.length >= 2) periodEnd = normalizeDate(dateMatches[1]!)
  if (dateMatches.length >= 3) dueDate = normalizeDate(dateMatches[2]!)
  if (!periodEnd && periodStart) periodEnd = periodStart

  const dueLabelMatch = html.match(/due\s*date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
  if (dueLabelMatch) dueDate = normalizeDate(dueLabelMatch[1]!)

  // PDF / document link: On "Your Invoice" page the blue "View Invoice" link goes to the actual bill (often docs.onlinebiller.com).
  let pdfUrl: string | null = null

  // 1) Direct link to document host (docs.onlinebiller.com/documents.php) = the actual bill — prefer this
  const docHostRegex = new RegExp(`href=["'](https?://[^"']*${DOCUMENT_DOMAIN.replace(".", "\\.")}[^"']*)["']`, "gi")
  let docMatch = docHostRegex.exec(html)
  if (docMatch && docMatch[1]) {
    pdfUrl = docMatch[1].trim()
  }
  if (!pdfUrl) {
    const docUrlAnywhere = html.match(new RegExp(`(https?://[^"'\\s<>]*${DOCUMENT_DOMAIN.replace(".", "\\.")}[^"'\\s<>]*)`, "i"))
    if (docUrlAnywhere && docUrlAnywhere[1]) pdfUrl = docUrlAnywhere[1].trim()
  }

  // 2) "View Invoice" link on the summary page (Options column) — href may be relative or go to invoicecloud then redirect
  if (!pdfUrl) {
    const linkBlockRegex = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkBlockRegex.exec(html)) !== null) {
      const attrs = linkMatch[1]!
      const inner = (linkMatch[2]! || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      if (/view\s*invoice|view\s*pdf|download\s*(?:pdf|bill)|print\s*invoice/i.test(inner)) {
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i)
        if (hrefMatch && hrefMatch[1]) {
          const raw = hrefMatch[1].trim()
          if (raw && !raw.startsWith("javascript:")) {
            pdfUrl = resolveUrl(raw, pageUrl)
            break
          }
        }
      }
    }
  }

  // 3) JavaScript that opens the document URL (e.g. window.open or location)
  if (!pdfUrl) {
    const jsDocUrl = html.match(new RegExp(`["'](https?://[^"']*${DOCUMENT_DOMAIN.replace(".", "\\.")}[^"']*)["']`, "i"))
    if (jsDocUrl && jsDocUrl[1]) pdfUrl = jsDocUrl[1].trim()
  }
  if (!pdfUrl) {
    const pdfHrefPatterns = [
      /<a\s+[^>]*href=["']([^"']*\.pdf[^"']*)["']/i,
      /href=["']([^"']*(?:\.pdf|download\.aspx|pdf\.aspx|getpdf|viewpdf|downloadpdf|invoice\.aspx)[^"']*)["']/i,
      /href=["']([^"']*(?:download|pdf|invoice)[^"']*)["']/i,
    ]
    for (const re of pdfHrefPatterns) {
      const match = html.match(re)
      if (match && match[1]) {
        const raw = match[1].trim()
        if (raw && !raw.startsWith("javascript:")) {
          pdfUrl = resolveUrl(raw, pageUrl)
          break
        }
      }
    }
  }

  // 3) Button/link with onclick that opens a URL (e.g. window.open('...') or location.href='...')
  if (!pdfUrl) {
    const jsUrlPatterns = [
      /(?:window\.open|location\.href|location\s*=\s*)\s*\(\s*["']([^"']+)["']/i,
      /(?:window\.open|location\.href)\s*\(\s*["']([^"']+)["']/i,
      /["'](https?:\/\/[^"']*(?:\.pdf|invoice|download)[^"']*)["']/i,
    ]
    for (const re of jsUrlPatterns) {
      const match = html.match(re)
      if (match && match[1]) {
        const raw = match[1].trim()
        if (raw && raw.startsWith("http") && raw.includes("invoicecloud")) {
          pdfUrl = raw
          break
        }
      }
    }
  }

  // 4) data-url, data-href, data-pdf on buttons/links
  if (!pdfUrl) {
    const dataUrlMatch = html.match(/data-(?:pdf-)?(?:url|href)=["']([^"']+)["']/i)
    if (dataUrlMatch && dataUrlMatch[1]) {
      const raw = dataUrlMatch[1].trim()
      if (raw && !raw.startsWith("javascript:")) pdfUrl = resolveUrl(raw, pageUrl)
    }
  }

  // 5) Form action that looks like PDF/invoice/download
  if (!pdfUrl) {
    const formMatch = html.match(/<form[^>]*action=["']([^"']*(?:pdf|download|invoice)[^"']*)["']/i)
    if (formMatch && formMatch[1]) {
      const raw = formMatch[1].trim()
      if (raw && !raw.startsWith("javascript:")) pdfUrl = resolveUrl(raw, pageUrl)
    }
  }

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
  if (links.length === 0) {
    return { ok: true, links_found: 0, results: [] }
  }

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

  const results: { url: string; bill_id?: string; error?: string }[] = []

  const fetchOptions = { headers: { "User-Agent": "Mozilla/5.0 (compatible; CoastMetering/1.0)" } } as RequestInit

  for (const invoiceUrl of links) {
    try {
      let res = await fetch(invoiceUrl, fetchOptions)
      let pageHtml = await res.text()
      let parsed = parseInvoicePage(pageHtml, invoiceUrl)

      // Step 2: "View invoice" on the bill page opens the document (often redirects to docs.onlinebiller.com). Use final URL after redirects.
      const viewInvoiceUrl = parsed.pdfUrl
      if (viewInvoiceUrl && !viewInvoiceUrl.toLowerCase().endsWith(".pdf")) {
        try {
          const res2 = await fetch(viewInvoiceUrl, fetchOptions)
          const contentType = res2.headers.get("content-type") ?? ""
          const finalUrl = res2.url || viewInvoiceUrl
          if (contentType.toLowerCase().includes("application/pdf")) {
            parsed = { ...parsed, pdfUrl: finalUrl }
          } else if (finalUrl.includes(DOCUMENT_DOMAIN)) {
            const pageHtml2 = await res2.text()
            const parsed2 = parseInvoicePage(pageHtml2, finalUrl)
            parsed = { ...parsed, pdfUrl: finalUrl }
            if (parsed2.accountNumber) parsed = { ...parsed, accountNumber: parsed2.accountNumber }
            if (parsed2.amountDue > 0) parsed = { ...parsed, amountDue: parsed2.amountDue }
            if (parsed2.dueDate) parsed = { ...parsed, dueDate: parsed2.dueDate }
          } else {
            const pageHtml2 = await res2.text()
            const parsed2 = parseInvoicePage(pageHtml2, finalUrl)
            if (parsed2.pdfUrl) parsed = { ...parsed, pdfUrl: parsed2.pdfUrl }
            else parsed = { ...parsed, pdfUrl: finalUrl }
            if (!parsed.accountNumber && parsed2.accountNumber) parsed = { ...parsed, accountNumber: parsed2.accountNumber }
            if (parsed2.amountDue > 0) parsed = { ...parsed, amountDue: parsed2.amountDue }
            if (parsed2.dueDate) parsed = { ...parsed, dueDate: parsed2.dueDate }
          }
        } catch {
          if (viewInvoiceUrl) parsed = { ...parsed, pdfUrl: viewInvoiceUrl }
        }
      }

      let accountNumber = (parsed.accountNumber || defaultAccount) ?? ""
      const propertyId = accountToProperty.get(accountNumber) ?? defaultPropertyId ?? null
      if (!accountNumber) accountNumber = defaultAccount ?? "unknown"

      const periodStart = parsed.periodStart || new Date().toISOString().slice(0, 10)
      const periodEnd = parsed.periodEnd || periodStart

      const billRow = {
        property_id: propertyId,
        utility_key: UTILITY_KEY,
        account_number: accountNumber,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        amount_due: parsed.amountDue >= 0 ? parsed.amountDue : 0,
        due_date: parsed.dueDate,
        pdf_url: parsed.pdfUrl,
        external_id: invoiceUrl.slice(0, 500),
        invoice_url: invoiceUrl,
        source_email_id: emailId,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

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

      if (upsertError) {
        results.push({ url: invoiceUrl, error: upsertError.message })
      } else {
        results.push({ url: invoiceUrl, bill_id: bill?.id ?? undefined })
      }
    } catch (err) {
      results.push({ url: invoiceUrl, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { ok: true, email_id: emailId, links_found: links.length, results }
}
