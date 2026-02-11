import { jsPDF } from "jspdf"

export interface BillData {
  keyValuePairs: Record<string, string>
  tables: string[][][]
}

const MARGIN = 20
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

// Normalize key for matching (lowercase, collapse spaces)
function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim()
}

// Find value by key (exact or normalized match)
function getByKey(pairs: Record<string, string>, ...keys: string[]): string {
  const keyMap = Object.fromEntries(
    Object.entries(pairs).map(([k, v]) => [norm(k), v])
  )
  for (const key of keys) {
    const v = keyMap[norm(key)]
    if (v) return v
  }
  return ""
}

/**
 * Generate a professional PDF bill from extracted Textract data.
 * Single clear "Amount Due" and one "Summary of Current Charges" table.
 */
export function generateBillPDF(
  data: BillData,
  _filename = "generated-bill.pdf"
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pairs = data.keyValuePairs
  let y = MARGIN

  // ----- Header -----
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  doc.text("Coast Metering", MARGIN, y)
  y += 10

  doc.setFontSize(14)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Utility Bill", MARGIN, y)
  y += 14

  // ----- Key details (account, service, dates) -----
  const account = getByKey(pairs, "ACCOUNT NUMBER", "Account Number", "Account")
  const serviceFor = getByKey(pairs, "SERVICE FOR", "Service For", "Service for")
  const serviceAddr = getByKey(
    pairs,
    "SERVICE ADDRESS:",
    "SERVICE ADDRESS",
    "Service Address"
  )
  const dateMailed = getByKey(pairs, "DATE MAILED", "Date Mailed")
  const dateDue = getByKey(pairs, "DATE DUE", "Date Due", "DUE DATE")

  const details: [string, string][] = []
  if (account) details.push(["Account Number", account])
  if (serviceFor) details.push(["Service For", serviceFor])
  if (serviceAddr) details.push(["Service Address", serviceAddr])
  if (dateMailed) details.push(["Date Mailed", dateMailed])
  if (dateDue) details.push(["Date Due", dateDue])

  if (details.length > 0) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    const lineH = 6
    for (const [label, value] of details) {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80)
      doc.text(label + ":", MARGIN, y)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(truncate(value, 50), MARGIN + 45, y)
      y += lineH
    }
    y += 10
  }

  // ----- Amount Due (single prominent box) -----
  const amountDue = getByKey(
    pairs,
    "AMOUNT DUE",
    "Amount Due",
    "Total Amount Due",
    "TOTAL AMOUNT DUE",
    "Total amount due"
  )
  if (amountDue || dateDue) {
    const boxY = y
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(MARGIN, boxY, CONTENT_WIDTH, 22)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    if (dateDue) doc.text("Date Due: " + dateDue, MARGIN + 4, boxY + 8)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Amount Due: " + (amountDue || "—"), MARGIN + 4, boxY + 16)
    y = boxY + 28
  }

  // ----- Account summary (previous balance, payments, current charges) -----
  const prevBalance = getByKey(pairs, "Previous Balance", "PREVIOUS BALANCE")
  const paymentReceived = getByKey(
    pairs,
    "Payment Received",
    "Payments",
    "PAYMENT RECEIVED"
  )
  const currentCharges = getByKey(
    pairs,
    "Current Charges",
    "CURRENT CHARGES",
    "Current charges"
  )
  const totalCharges = getByKey(
    pairs,
    "Total Charges this Month",
    "Total charges this month"
  )
  if (prevBalance || paymentReceived || currentCharges || totalCharges) {
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("Account Summary", MARGIN, y)
    y += 7
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    if (prevBalance) {
      doc.text("Previous Balance: " + prevBalance, MARGIN, y)
      y += 6
    }
    if (paymentReceived) {
      doc.text("Payment Received: " + paymentReceived, MARGIN, y)
      y += 6
    }
    if (currentCharges) {
      doc.text("Current Charges: " + currentCharges, MARGIN, y)
      y += 6
    }
    if (totalCharges) {
      doc.text("Total Charges This Month: " + totalCharges, MARGIN, y)
      y += 6
    }
    y += 8
  }

  // ----- Single "Summary of Current Charges" table -----
  const tables = data.tables.filter((t) => t.length > 0)
  if (tables.length > 0) {
    if (y > PAGE_HEIGHT - MARGIN - 50) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("Summary of Current Charges", MARGIN, y)
    y += 8

    // Use only the first table as the single itemized charges section
    const table = tables[0]
    const numCols = Math.max(...table.map((row) => row.length))
    const colWidth = CONTENT_WIDTH / Math.max(numCols, 1)
    const rowHeight = 8

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    table[0].forEach((cell, i) => {
      doc.text(truncate(String(cell || ""), 22), MARGIN + i * colWidth + 2, y + 5)
    })
    y += rowHeight
    doc.setDrawColor(180, 180, 180)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 4

    doc.setFont("helvetica", "normal")
    for (let row = 1; row < table.length; row++) {
      if (y > PAGE_HEIGHT - MARGIN - 15) {
        doc.addPage()
        y = MARGIN
      }
      table[row].forEach((cell, i) => {
        doc.text(truncate(String(cell || ""), 22), MARGIN + i * colWidth + 2, y + 5)
      })
      y += rowHeight
    }
    y += 14
  }

  // ----- Footer -----
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    "Generated by Coast Metering — This bill was generated from extracted document data.",
    MARGIN,
    PAGE_HEIGHT - 10
  )

  return doc.output("blob")
}

function truncate(str: string, max: number): string {
  if (!str) return ""
  if (str.length <= max) return str
  return str.slice(0, max - 2) + ".."
}
