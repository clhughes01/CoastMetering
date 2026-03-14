import { createSupabaseAdminClient } from "@/lib/supabase/client"

const UTILITY_KEY = "escondido_water"
const INVOICE_DOMAIN = "invoicecloud.com"

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

/** Extract URLs from HTML or plain text that look like Invoice Cloud view/pay links */
export function extractInvoiceLinks(html: string, text: string): string[] {
  const combined = html || text || ""
  const links: string[] = []
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = hrefRegex.exec(combined)) !== null) {
    const url = m[1]!.trim()
    if (
      url.includes(INVOICE_DOMAIN) &&
      (url.includes("view") || url.includes("invoice") || url.includes("pay") || url.includes("portal"))
    ) {
      links.push(url)
    }
  }
  const urlOnlyRegex = /https?:\/\/[^\s<>"']*invoicecloud[^\s<>"']*/gi
  combined.replace(urlOnlyRegex, (u) => {
    if (!links.includes(u)) links.push(u)
    return u
  })
  return Array.from(new Set(links))
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

  // Account number: try several label patterns, then bare #digits, then URL params
  const accountPatterns = [
    /account\s*#?\s*[:\s]*(\d{4,})/i,
    /account\s*number\s*[:\s]*(\d{4,})/i,
    /customer\s*account\s*[:\s#]*(\d{4,})/i,
    /(?:account|acct)\s*no\.?\s*[:\s]*(\d{4,})/i,
    /#\s*(\d{4,})/,
  ]
  for (const re of accountPatterns) {
    const m = html.match(re)
    if (m && m[1]) {
      accountNumber = m[1].trim()
      break
    }
  }
  if (!accountNumber) {
    const urlAccount = pageUrl.match(/account(?:number|id)?[=:](\d{4,})/i) || pageUrl.match(/[?&]id=(\d{4,})/)
    if (urlAccount) accountNumber = urlAccount[1]!.trim()
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

  // PDF / invoice link: often behind "View invoice" or "Download" button. Check link text first, then hrefs, then JS.
  let pdfUrl: string | null = null
  const baseHost = (() => {
    try {
      return new URL(pageUrl).origin
    } catch {
      return ""
    }
  })()

  // 1) Links whose text looks like "View invoice", "View PDF", "Download" — take the href (or follow if needed)
  const viewInvoiceLinkRegex =
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?(?:view\s*invoice|view\s*pdf|download\s*pdf|download\s*bill|print\s*invoice|get\s*pdf)[\s\S]*?<\/a>/i
  let m = html.match(viewInvoiceLinkRegex)
  if (m && m[1]) {
    const raw = m[1].trim()
    if (raw && !raw.startsWith("javascript:")) {
      pdfUrl = resolveUrl(raw, pageUrl)
    }
  }

  // 2) Same idea: href first, then look for link text (order reversed for "href contains pdf/download")
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

      // If the "bill" is behind a button, the parser may have found a "View invoice" link that points to another page. Fetch it and get the PDF from there.
      const viewInvoiceUrl = parsed.pdfUrl
      if (viewInvoiceUrl && !viewInvoiceUrl.toLowerCase().endsWith(".pdf") && (viewInvoiceUrl.includes(".aspx") || viewInvoiceUrl.includes("/invoice"))) {
        try {
          const res2 = await fetch(viewInvoiceUrl, fetchOptions)
          const pageHtml2 = await res2.text()
          const parsed2 = parseInvoicePage(pageHtml2, viewInvoiceUrl)
          if (parsed2.pdfUrl) parsed = { ...parsed, pdfUrl: parsed2.pdfUrl }
          if (!parsed.accountNumber && parsed2.accountNumber) parsed = { ...parsed, accountNumber: parsed2.accountNumber }
        } catch {
          // keep original parsed
        }
      }

      // Use parsed account if it matches a mapping; otherwise use default when only one property is mapped
      let accountNumber = (parsed.accountNumber || defaultAccount) ?? ""
      let propertyId = accountToProperty.get(accountNumber) ?? defaultPropertyId
      if (!propertyId && defaultPropertyId && defaultAccount) {
        propertyId = defaultPropertyId
        accountNumber = defaultAccount
      }
      if (!propertyId) {
        results.push({ url: invoiceUrl, error: `No property mapped for account ${accountNumber || "unknown"}. Add mapping in Admin → Utility accounts.` })
        continue
      }
      if (!accountNumber) accountNumber = defaultAccount ?? "unknown"

      const periodStart = parsed.periodStart || new Date().toISOString().slice(0, 10)
      const periodEnd = parsed.periodEnd || periodStart

      const { data: bill, error: upsertError } = await supabase
        .from("utility_provider_bills")
        .upsert(
          {
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
          },
          { onConflict: "property_id,utility_key,billing_period_start", ignoreDuplicates: false }
        )
        .select("id")
        .single()

      if (upsertError) {
        results.push({ url: invoiceUrl, error: upsertError.message })
      } else {
        results.push({ url: invoiceUrl, bill_id: bill?.id })
      }
    } catch (err) {
      results.push({ url: invoiceUrl, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { ok: true, email_id: emailId, links_found: links.length, results }
}
