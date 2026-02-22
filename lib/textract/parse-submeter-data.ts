/**
 * Parse submeter data (CSV or tab-separated) into units with usage.
 * Detects the usage column by name (Reading, Usage, Gallons, etc.) or by being the main numeric column.
 */

export interface SubmeterUnit {
  /** Display label for the unit (e.g. "Unit 1", account number, tenant name) */
  label: string
  /** Numeric usage for proportional allocation (e.g. gallons, kWh) */
  usage: number
}

const USAGE_COLUMN_NAMES = [
  "current reading",
  "end reading",
  "reading",
  "readings",
  "usage",
  "use",
  "consumption",
  "gallons",
  "gal",
  "kwh",
  "water",
  "meter",
  "current",
  "end",
  "read",
]
const UNIT_COLUMN_NAMES = ["unit", "units", "account", "tenant", "name", "id", "suite", "apt", "apartment"]
// Prefer usage column with these (over e.g. "previous reading")
const PREFER_USAGE_CONTAINS = ["current", "usage", "end", "consumption", "reading"]
const AVOID_USAGE_CONTAINS = ["previous", "start", "begin"]

function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase()
}

function parseNumber(s: string): number | null {
  const cleaned = String(s).replace(/[,$\s]/g, "")
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** True if n looks like a meter reading (has decimals or is large), not a unit number like 409/415. */
function looksLikeMeterReading(n: number): boolean {
  if (n < 50 || n > 50000) return false
  if (n % 1 !== 0) return true
  return n >= 1000
}

/** Extract all numbers from raw text that look like meter readings (ignores CSV structure). */
function extractReadingsFromRawText(text: string): SubmeterUnit[] {
  const result: SubmeterUnit[] = []
  const seen = new Set<number>()
  const normalized = text.replace(/\s+/g, " ")
  const patterns = [
    /[\d,]+\.\d+/g,
    /[\d,]+\.?\d*/g,
  ]
  for (const regex of patterns) {
    result.length = 0
    seen.clear()
    let m: RegExpExecArray | null
    while ((m = regex.exec(normalized)) !== null) {
      const n = parseNumber(m[0]!)
      if (n !== null && looksLikeMeterReading(n) && !seen.has(n)) {
        seen.add(n)
        result.push({ label: `Unit ${result.length + 1}`, usage: n })
      }
    }
    if (result.length >= 1) return result
  }
  seen.clear()
  result.length = 0
  const anyInRange: number[] = []
  const re2 = /[\d,]+\.?\d*/g
  let m2: RegExpExecArray | null
  while ((m2 = re2.exec(normalized)) !== null) {
    const n = parseNumber(m2[0]!)
    if (n !== null && n >= 100 && n <= 50000 && !anyInRange.includes(n)) anyInRange.push(n)
  }
  anyInRange.sort((a, b) => b - a)
  const take = anyInRange.length >= 2 ? 2 : anyInRange.length
  for (let i = 0; i < take; i++) {
    result.push({ label: `Unit ${i + 1}`, usage: anyInRange[i]! })
  }
  return result
}

/** Scan entire grid for numbers that look like meter readings; return one unit per distinct value. */
function scanGridForReadings(allRows: string[][]): SubmeterUnit[] {
  const seen = new Set<number>()
  const result: SubmeterUnit[] = []
  for (const row of allRows) {
    for (const cell of row) {
      const n = parseNumber(cell)
      if (n !== null && looksLikeMeterReading(n) && !seen.has(n)) {
        seen.add(n)
        result.push({ label: `Unit ${result.length + 1}`, usage: n })
      }
    }
  }
  return result
}

/** Split a CSV line respecting quoted commas (e.g. "a,b" stays one cell). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes && (sep === "," ? ch === "," : ch === sep)) {
      out.push(cur.trim().replace(/^"|"$/g, ""))
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur.trim().replace(/^"|"$/g, ""))
  return out
}

function looksLikeHeader(cell: string): boolean {
  const lower = cell.trim().toLowerCase()
  return (
    UNIT_COLUMN_NAMES.some((u) => lower.includes(u)) ||
    USAGE_COLUMN_NAMES.some((u) => lower.includes(u)) ||
    lower === "description" ||
    lower === "amount"
  )
}

/** Header looks like a reading column (for wide layout). */
function isReadingHeader(h: string): boolean {
  const lower = normalizeHeader(h)
  return USAGE_COLUMN_NAMES.some((u) => lower.includes(u) || u.includes(lower)) && !AVOID_USAGE_CONTAINS.some((a) => lower.includes(a))
}

/** Extract unit label from header row: "UNIT 409", "409", "Unit 415", or column index. */
function getUnitLabelFromHeaderRow(row: string[], colIndex: number): string {
  const thisCell = String(row[colIndex] ?? "").trim()
  if (thisCell && /^unit\s*\d+|^\d{2,}$/i.test(thisCell.replace(/\s/g, ""))) return thisCell
  for (let c = colIndex - 1; c >= Math.max(0, colIndex - 5); c--) {
    const v = String(row[c] ?? "").trim()
    if (!v) continue
    if (/unit\s*\d+|^\d{2,}$/i.test(v.replace(/\s/g, ""))) return v
    if (/^\d+$/.test(v)) return `Unit ${v}`
  }
  return ""
}

/**
 * Parse "wide" layout: each unit has its own Reading column with one value per column.
 * E.g. ... | UNIT 409 Reading | ... | UNIT 415 Reading | ... with 428.995 and 2987.57 in one data row.
 */
function parseWideLayout(
  allRows: string[][],
  firstRowIsHeader: boolean,
  _sep: string
): SubmeterUnit[] {
  if (allRows.length < 1) return []

  const numCols = Math.max(...allRows.map((r) => r.length), 1)
  const readingCount = (row: string[]) => row.filter((c) => isReadingHeader(normalizeHeader(c)) || normalizeHeader(c) === "reading").length

  let headerRowIndex = 0
  let headerRow = allRows[0]!.map((c) => String(c).trim())
  let best = readingCount(headerRow)
  for (let r = 1; r < Math.min(5, allRows.length); r++) {
    const row = allRows[r]!.map((c) => String(c).trim())
    const n = readingCount(row)
    if (n > best) {
      best = n
      headerRow = row
      headerRowIndex = r
    }
  }

  const dataRows = allRows.slice(headerRowIndex + 1)
  const result: SubmeterUnit[] = []

  for (let c = 0; c < numCols; c++) {
    const rawHeader = String(headerRow[c] ?? "").trim()
    const header = normalizeHeader(rawHeader)
    let usage: number | null = null
    for (let r = 0; r < dataRows.length; r++) {
      const val = parseNumber(dataRows[r]![c] ?? "")
      if (val !== null && val >= 0) {
        usage = val
        break
      }
    }
    const isReadingCol = isReadingHeader(header) || header === "reading" || (!header && usage !== null)
    if (!isReadingCol || usage === null) continue

    let label = getUnitLabelFromHeaderRow(headerRow, c)
    if (!label) label = `Unit ${result.length + 1}`
    if (/^\d+$/.test(label)) label = `Unit ${label}`
    result.push({ label, usage })
  }

  if (result.length >= 1) return result

  // No "Reading" headers found: collect any column that has a meter-like number (100–50000)
  for (let c = 0; c < numCols; c++) {
    let usage: number | null = null
    for (let r = 0; r < dataRows.length; r++) {
      const val = parseNumber(dataRows[r]![c] ?? "")
      if (val !== null && val >= 100 && val <= 50000) {
        usage = val
        break
      }
    }
    if (usage === null) continue
    let label = getUnitLabelFromHeaderRow(headerRow, c)
    if (!label) label = `Unit ${result.length + 1}`
    if (/^\d+$/.test(label)) label = `Unit ${label}`
    result.push({ label, usage })
  }

  return result
}

/**
 * Parse CSV-like text (comma or tab separated) into rows.
 * First row is treated as headers; if it looks like data (all numeric in last col), treat as no header.
 */
export function parseSubmeterData(csvLike: string): SubmeterUnit[] {
  const trimmed = csvLike.trim().replace(/^\uFEFF/, "") // BOM
  if (!trimmed) return []

  const rawReadings = extractReadingsFromRawText(trimmed)
  if (rawReadings.length >= 1) return rawReadings

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 1) return []

  const first = lines[0]!
  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ","
  const allRows = lines.map((line) => splitCsvLine(line, sep).map((c) => c.trim().replace(/^"|"$/g, "")))
  const firstRow = allRows[0]!
  const firstRowLooksLikeHeader =
    firstRow.some((c) => looksLikeHeader(c)) ||
    (firstRow.length >= 2 && parseNumber(firstRow[firstRow.length - 1] ?? "") === null)
  const headers = firstRowLooksLikeHeader ? firstRow.map((h) => normalizeHeader(h)) : []
  const rows = firstRowLooksLikeHeader ? allRows.slice(1) : allRows
  const numCols = Math.max(...allRows.map((r) => r.length), 1)
  if (numCols < 1) return []
  let usageCol = -1
  let unitCol = -1

  if (headers.length >= 2) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]!
      if (USAGE_COLUMN_NAMES.some((u) => h.includes(u) || u.includes(h))) {
        const avoid = AVOID_USAGE_CONTAINS.some((a) => h.includes(a))
        const prefer = PREFER_USAGE_CONTAINS.some((p) => h.includes(p))
        if (avoid) continue
        if (usageCol < 0 || prefer) usageCol = i
      }
      if (UNIT_COLUMN_NAMES.some((u) => h.includes(u) || u.includes(h))) unitCol = i
    }
  }

  // When no header matched: pick the numeric column that looks like meter readings (largest sum).
  // Unit IDs are often 1,2,3; readings are hundreds/thousands.
  if (usageCol < 0) {
    let bestCol = -1
    let bestSum = 0
    for (let c = 0; c < numCols; c++) {
      const values = rows.map((r) => r[c])
      const numbers = values.map(parseNumber).filter((n): n is number => n !== null && n >= 0)
      if (numbers.length < rows.length * 0.5) continue
      const sum = numbers.reduce((a, b) => a + b, 0)
      if (sum > bestSum) {
        bestSum = sum
        bestCol = c
      }
    }
    if (bestCol >= 0) usageCol = bestCol
  }

  if (usageCol < 0) {
    // Last resort 1: assume two columns (label, usage), any row with two values and second is number
    const twoCol = rows.filter(
      (r) => r.length >= 2 && parseNumber(r[1] ?? "") !== null && parseNumber(r[1] ?? "")! >= 0
    )
    if (twoCol.length >= 1) {
      return twoCol.map((row, i) => ({
        label: String(row[0] ?? "").trim() || `Unit ${i + 1}`,
        usage: parseNumber(row[1]!)!,
      }))
    }

    // Last resort 2: wide layout — each unit has its own "Reading" column with one value
    const wide = parseWideLayout(allRows, firstRowLooksLikeHeader, sep)
    if (wide.length >= 1) return wide

    // Last resort 3: scan entire grid for any numbers that look like meter readings (50–50000)
    const found = scanGridForReadings(allRows)
    if (found.length >= 1) return found

    return []
  }

  const result: SubmeterUnit[] = []
  const labelCol = unitCol >= 0 ? unitCol : 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const usageVal = parseNumber(row[usageCol] ?? "")
    if (usageVal === null || usageVal < 0) continue
    const label =
      row[labelCol] != null && String(row[labelCol]).trim()
        ? String(row[labelCol]).trim()
        : `Unit ${i + 1}`
    result.push({ label: label || `Unit ${i + 1}`, usage: usageVal })
  }

  return result
}
