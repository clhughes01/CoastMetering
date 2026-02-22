import { jsPDF } from "jspdf"

export interface StructuredBillForPDF {
  accountNumber: string
  serviceFor: string
  serviceAddress: string
  dateMailed: string
  dateDue: string
  amountDue: string
  previousBalance?: string
  paymentReceived?: string
  currentCharges?: string
  totalChargesThisMonth?: string
  lineItems: { description: string; quantity?: string; rate?: string; amount: string }[]
  propertyAddress?: string
  owner?: string
  waterUtility?: string
  powerUtility?: string
  gasUtility?: string
  billingPeriod?: string
  numberOfUnits?: string
}

const MARGIN = 18
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function truncate(str: string, max: number): string {
  if (!str) return ""
  if (str.length <= max) return str
  return str.slice(0, max - 2) + ".."
}

/**
 * Load an image from URL and return as data URL (for use in jsPDF).
 * Call from browser only. Use /images/coast-metering-logo.png for the Coast Metering logo.
 */
export function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error("Failed to load logo image"))
    img.src = url
  })
}

/**
 * Fill a jsPDF document with the bill layout (shared by client and server).
 * Logo: data URL string, e.g. "data:image/png;base64,..." or from loadImageAsDataUrl().
 * Clean, professional layout without heavy boxes.
 */
export function buildBillPDF(
  doc: jsPDF,
  bill: StructuredBillForPDF,
  logoDataUrl?: string
): void {
  let y = MARGIN

  // ----- Header: logo + company name (no box, clean) -----
  const headerHeight = 26
  if (logoDataUrl) {
    try {
      const logoW = 34
      const logoH = Math.min(20, headerHeight - 2)
      doc.addImage(logoDataUrl, "PNG", MARGIN, y + (headerHeight - logoH) / 2, logoW, logoH)
      doc.setFontSize(20)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Coast Metering", MARGIN + logoW + 10, y + 8)
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.text("Utility Bill", MARGIN + logoW + 10, y + 16)
    } catch {
      doc.setFontSize(20)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Coast Metering", MARGIN, y + 10)
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.text("Utility Bill", MARGIN, y + 18)
    }
  } else {
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text("Coast Metering", MARGIN, y + 10)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    doc.text("Utility Bill", MARGIN, y + 18)
  }
  y += headerHeight + 4
  doc.setDrawColor(230, 230, 230)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 16

  const hasMetadata =
    bill.propertyAddress || bill.owner || bill.waterUtility || bill.powerUtility || bill.gasUtility || bill.billingPeriod || bill.numberOfUnits

  if (hasMetadata) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(90, 90, 90)
    if (bill.propertyAddress) {
      doc.text("Property: " + truncate(bill.propertyAddress, 72), MARGIN, y)
      y += 5
    }
    if (bill.owner) {
      doc.text("Owner: " + truncate(bill.owner, 72), MARGIN, y)
      y += 5
    }
    const utils: string[] = []
    if (bill.waterUtility) utils.push("Water: " + bill.waterUtility)
    if (bill.powerUtility) utils.push("Power: " + bill.powerUtility)
    if (bill.gasUtility) utils.push("Gas: " + bill.gasUtility)
    if (utils.length > 0) {
      doc.text(utils.join("  •  "), MARGIN, y)
      y += 5
    }
    if (bill.billingPeriod) {
      doc.text("Billing Period: " + bill.billingPeriod, MARGIN, y)
      y += 5
    }
    if (bill.numberOfUnits) {
      doc.text("Units: " + bill.numberOfUnits, MARGIN, y)
      y += 5
    }
    y += 8
  }

  // ----- Bill details: label / value pairs -----
  const details: [string, string][] = [
    ["Account Number", bill.accountNumber],
    ["Service For", bill.serviceFor],
    ["Service Address", bill.serviceAddress],
    ["Date Mailed", bill.dateMailed],
    ["Date Due", bill.dateDue],
  ]
  doc.setFontSize(10)
  const labelW = 40
  const lineH = 7
  for (const [label, value] of details) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(90, 90, 90)
    doc.text(label + ":", MARGIN, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(20, 20, 20)
    doc.text(truncate(value, 55), MARGIN + labelW, y)
    y += lineH
  }
  y += 14

  // ----- Amount Due: prominent but no heavy box -----
  doc.setFillColor(250, 250, 250)
  doc.rect(MARGIN, y, CONTENT_WIDTH, 24, "F")
  doc.setDrawColor(238, 238, 238)
  doc.setLineWidth(0.25)
  doc.rect(MARGIN, y, CONTENT_WIDTH, 24)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  doc.text("Due by " + (bill.dateDue || "—"), MARGIN + 8, y + 9)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(20, 20, 20)
  doc.text("Amount Due " + (bill.amountDue || "—"), MARGIN + 8, y + 19)
  y += 30

  // ----- Account Summary (optional) -----
  const hasSummary =
    bill.previousBalance ||
    bill.paymentReceived ||
    bill.currentCharges ||
    bill.totalChargesThisMonth
  if (hasSummary) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(40, 40, 40)
    doc.text("Account Summary", MARGIN, y)
    y += 7
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    if (bill.previousBalance) {
      doc.text("Previous Balance: " + bill.previousBalance, MARGIN, y)
      y += 5
    }
    if (bill.paymentReceived) {
      doc.text("Payment Received: " + bill.paymentReceived, MARGIN, y)
      y += 5
    }
    if (bill.currentCharges) {
      doc.text("Current Charges: " + bill.currentCharges, MARGIN, y)
      y += 5
    }
    if (bill.totalChargesThisMonth) {
      doc.text("Total Charges This Month: " + bill.totalChargesThisMonth, MARGIN, y)
      y += 5
    }
    y += 12
  }

  // ----- Summary of Current Charges: clean table (horizontal lines only, no grid) -----
  if (bill.lineItems.length > 0) {
    if (y > PAGE_HEIGHT - MARGIN - 50) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(40, 40, 40)
    doc.text("Summary of Current Charges", MARGIN, y)
    y += 10

    const descWidth = CONTENT_WIDTH - 42
    const rowHeight = 10

    const hasQtyRate = bill.lineItems.some(
      (r) => (r.quantity != null && r.quantity !== "—" && r.quantity.trim() !== "") || (r.rate != null && r.rate !== "—" && r.rate.trim() !== "")
    )

    if (hasQtyRate) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text("Description", MARGIN, y + 6)
      doc.text("Qty", MARGIN + descWidth + 4, y + 6)
      doc.text("Rate", MARGIN + descWidth + 18, y + 6)
      doc.text("Amount", PAGE_WIDTH - MARGIN, y + 6, { align: "right" })
    } else {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text("Description", MARGIN, y + 6)
      doc.text("Amount", PAGE_WIDTH - MARGIN, y + 6, { align: "right" })
    }
    y += rowHeight

    doc.setDrawColor(240, 240, 240)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 2

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    for (let i = 0; i < bill.lineItems.length; i++) {
      const row = bill.lineItems[i]!
      if (y > PAGE_HEIGHT - MARGIN - 18) {
        doc.addPage()
        y = MARGIN
      }
      doc.setTextColor(50, 50, 50)
      doc.text(truncate(row.description, 48), MARGIN, y + 6)
      if (hasQtyRate) {
        doc.text(truncate(row.quantity ?? "—", 6), MARGIN + descWidth + 4, y + 6)
        doc.text(truncate(row.rate ?? "—", 8), MARGIN + descWidth + 18, y + 6)
      }
      doc.setTextColor(20, 20, 20)
      doc.text(row.amount, PAGE_WIDTH - MARGIN, y + 6, { align: "right" })
      y += rowHeight
      doc.setDrawColor(245, 245, 245)
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
      y += 2
    }
    y += 14
  }

  // ----- Footer -----
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 140)
  doc.setFont("helvetica", "normal")
  doc.text(
    "Generated by Coast Metering — Submetered utility billing.",
    MARGIN,
    PAGE_HEIGHT - 12
  )
}

/**
 * Generate PDF as Blob (browser). Logo: use loadImageAsDataUrl("/images/coast-metering-logo.png").
 */
export function generateBillPDFFromStructured(
  bill: StructuredBillForPDF,
  logoDataUrl?: string
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  buildBillPDF(doc, bill, logoDataUrl)
  return doc.output("blob")
}
