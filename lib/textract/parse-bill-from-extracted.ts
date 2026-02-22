/**
 * Parse extracted bill data (Textract keyValuePairs + tables) into total due,
 * merged line items (one per charge type), and common fields for PDFs.
 */

export interface ParsedBillLineItem {
  description: string
  amount: number
}

export interface ParsedBill {
  totalDue: number
  lineItems: ParsedBillLineItem[]
  accountNumber: string
  serviceAddress: string
  dateMailed: string
  dateDue: string
}

function parseMoney(s: string): number | null {
  const cleaned = String(s).replace(/[^\d.-]/g, "")
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function findKey(keyValuePairs: Record<string, string>, ...candidates: string[]): string | undefined {
  const lower = Object.keys(keyValuePairs).reduce<Record<string, string>>((acc, k) => {
    acc[k.toLowerCase().trim()] = keyValuePairs[k]!
    return acc
  }, {})
  for (const c of candidates) {
    const v = lower[c.toLowerCase().trim()]
    if (v) return v
  }
  for (const key of Object.keys(lower)) {
    if (candidates.some((c) => key.includes(c.toLowerCase()))) return lower[key]
  }
  return undefined
}

/** Normalize description for merging (e.g. "Water Service" and "Water Service " -> same) */
function normDesc(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/**
 * Find the charges table: has Description and Amount (or Amt) columns.
 * Returns merged line items (same description -> sum of amounts).
 */
function parseLineItemsFromTables(tables: string[][][]): ParsedBillLineItem[] {
  const merged = new Map<string, number>()

  for (const table of tables) {
    if (table.length < 1) continue
    const numCols = Math.max(...table.map((r) => r.length), 1)
    let headerRowIndex = 0
    let descCol = 0
    let amountCol = numCols - 1
    for (let r = 0; r < Math.min(3, table.length); r++) {
      const row = table[r]!.map((c) => String(c).trim().toLowerCase())
      for (let i = 0; i < row.length; i++) {
        const h = row[i]!
        if (h.includes("description") || h === "desc") descCol = i
        if (h.includes("amount") || h === "amt") amountCol = i
      }
      if (row.some((h) => h.includes("description") || h.includes("amount"))) {
        headerRowIndex = r
        break
      }
    }
    const dataStart = table[headerRowIndex]?.some((c) => {
      const h = String(c).trim().toLowerCase()
      return h.includes("description") || h.includes("amount")
    })
      ? headerRowIndex + 1
      : 0
    for (let r = dataStart; r < table.length; r++) {
      const row = table[r]!
      const desc = normDesc(String(row[descCol] ?? ""))
      const amt = parseMoney(String(row[amountCol] ?? ""))
      if (!desc || amt === null) continue
      merged.set(desc, (merged.get(desc) ?? 0) + amt)
    }
  }

  return Array.from(merged.entries()).map(([description, amount]) => ({ description, amount }))
}

/**
 * Get total due from keyValuePairs or sum of line items.
 */
function getTotalDue(
  keyValuePairs: Record<string, string>,
  lineItems: ParsedBillLineItem[]
): number {
  const fromKv = findKey(
    keyValuePairs,
    "amount due",
    "total due",
    "total",
    "balance due",
    "current charges",
    "balance",
    "amount"
  )
  const n = fromKv ? parseMoney(fromKv) : null
  if (n !== null && n > 0) return n
  const sum = lineItems.reduce((s, li) => s + li.amount, 0)
  return sum > 0 ? sum : 0
}

/** Try to find a total amount in raw text (e.g. "Amount Due $348.89" or "Total 348.89"). */
export function getTotalFromText(text: string): number | null {
  if (!text || !text.trim()) return null
  const match = text.match(/(?:amount\s+due|total|balance\s+due|due)\s*\$?\s*([\d,]+\.?\d{0,2})/i)
  if (match) {
    const n = parseMoney(match[1]!)
    return n
  }
  const amounts = text.match(/\$?([\d,]+\.\d{2})\b/g)
  if (amounts && amounts.length > 0) {
    const parsed = amounts.map((a) => parseMoney(a.replace(/[$,]/g, "")))
    const valid = parsed.filter((n): n is number => n !== null && n > 0)
    if (valid.length > 0) return Math.max(...valid)
  }
  return null
}

/** Get bill total from extracted data (keyValuePairs + text) without requiring full parse. */
export function getTotalFromExtracted(extracted: {
  keyValuePairs: Record<string, string>
  text?: string
}): number | null {
  const fromKv = getTotalDue(extracted.keyValuePairs, [])
  if (fromKv > 0) return fromKv
  // Scan any key that suggests a total/amount and take the largest reasonable value
  for (const [k, v] of Object.entries(extracted.keyValuePairs)) {
    const key = k.toLowerCase()
    if (!key.includes("amount") && !key.includes("total") && !key.includes("due") && !key.includes("balance")) continue
    const n = parseMoney(v)
    if (n != null && n >= 1 && n <= 50000) return n
  }
  if (extracted.text) return getTotalFromText(extracted.text)
  return null
}

export function parseBillFromExtracted(extracted: {
  keyValuePairs: Record<string, string>
  tables: string[][][]
  text?: string
}): ParsedBill | null {
  const lineItems = parseLineItemsFromTables(extracted.tables)
  let totalDue = getTotalDue(extracted.keyValuePairs, lineItems)
  if (totalDue <= 0 && extracted.text) {
    const fromText = getTotalFromText(extracted.text)
    if (fromText != null && fromText > 0) totalDue = fromText
  }

  // If we have no total and no line items, we can't build a bill
  if (totalDue <= 0 && lineItems.length === 0) return null

  const accountNumber =
    findKey(
      extracted.keyValuePairs,
      "account number",
      "account",
      "account no",
      "acct"
    ) ?? "—"
  const serviceAddress =
    findKey(
      extracted.keyValuePairs,
      "service address",
      "address",
      "property address"
    ) ?? "—"
  const dateDue =
    findKey(extracted.keyValuePairs, "date due", "due date", "due") ?? "—"
  const dateMailed =
    findKey(extracted.keyValuePairs, "date mailed", "mailed", "mail date") ?? "—"

  return {
    totalDue,
    lineItems: lineItems.length > 0 ? lineItems : [{ description: "Current charges", amount: totalDue }],
    accountNumber,
    serviceAddress,
    dateMailed,
    dateDue,
  }
}
