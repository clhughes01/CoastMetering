import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { jsPDF } from "jspdf"
import { buildBillPDF, type StructuredBillForPDF } from "./generate-bill-pdf-from-structured"

const LOGO_PATH = join(process.cwd(), "public", "images", "coast-metering-logo.png")

/**
 * Generate a single bill PDF as Buffer (server-side). Uses logo from public/images if present.
 */
export function generateBillPDFBuffer(
  bill: StructuredBillForPDF,
  logoBase64OrDataUrl?: string
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  let logoDataUrl: string | undefined
  if (logoBase64OrDataUrl) {
    logoDataUrl = logoBase64OrDataUrl.startsWith("data:")
      ? logoBase64OrDataUrl
      : `data:image/png;base64,${logoBase64OrDataUrl}`
  } else if (existsSync(LOGO_PATH)) {
    const buf = readFileSync(LOGO_PATH)
    logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`
  }
  buildBillPDF(doc, bill, logoDataUrl)
  return Buffer.from(doc.output("arraybuffer"))
}
