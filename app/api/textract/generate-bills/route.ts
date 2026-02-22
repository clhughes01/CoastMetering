import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** Structured bill for PDF generation (one per unit or single property). */
export interface StructuredBill {
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
}

const BILLS_JSON_SCHEMA = `{
  "bills": [
    {
      "accountNumber": "string",
      "serviceFor": "string",
      "serviceAddress": "string",
      "dateMailed": "string (e.g. MM/DD/YYYY)",
      "dateDue": "string (e.g. MM/DD/YYYY)",
      "amountDue": "string (e.g. 123.45 or $123.45)",
      "previousBalance": "optional string",
      "paymentReceived": "optional string",
      "currentCharges": "optional string",
      "totalChargesThisMonth": "optional string",
      "lineItems": [
        { "description": "string", "quantity": "optional", "rate": "optional", "amount": "string" }
      ]
    }
  ]
}`

function formatExtractedForPrompt(extracted: {
  keyValuePairs: Record<string, string>
  tables: string[][][]
  text: string
}): string {
  const lines: string[] = []
  if (Object.keys(extracted.keyValuePairs).length > 0) {
    lines.push("Key-value pairs:")
    for (const [k, v] of Object.entries(extracted.keyValuePairs)) {
      lines.push(`  ${k}: ${v}`)
    }
  }
  if (extracted.tables.length > 0) {
    lines.push("Tables:")
    extracted.tables.forEach((table, i) => {
      table.forEach((row) => lines.push("  " + row.join(" | ")))
    })
  }
  if (extracted.text?.trim()) {
    lines.push("Raw text:")
    lines.push(extracted.text.slice(0, 6000))
  }
  return lines.join("\n")
}

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI is not configured. Add OPENAI_API_KEY to your .env file." },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { extractedData, submeterData } = body as {
      extractedData?: { keyValuePairs: Record<string, string>; tables: string[][][]; text: string }
      submeterData?: string
    }

    if (!extractedData) {
      return NextResponse.json(
        { error: "extractedData is required. Analyze a bill first." },
        { status: 400 }
      )
    }

    const extractedBlock = formatExtractedForPrompt(extractedData)
    const hasSubmeter = Boolean(submeterData?.trim())

    const systemPrompt = `You are a bill formatter for Coast Metering. Your ONLY job is to output valid JSON and nothing else—no markdown, no explanation, no code fence.

Output a single JSON object with a "bills" array. Each bill must follow this exact schema:
${BILLS_JSON_SCHEMA}

Rules:
- From the extracted BILL data (the utility bill from Textract), get: total amount due, dates (date mailed, date due), service address, and any account info. This is the property-level bill total.
${hasSubmeter
  ? `- You are also given SUBMETER DATA (Excel or table): each row is a unit with usage (e.g. gallons or kWh). Use the proportions: each unit's share = (unit usage / total usage) × bill total. Create ONE bill per unit/row in the submeter data, with that unit's account number or identifier, the same dates and address (or unit-specific address if provided), and amountDue = that unit's proportional share. lineItems can show the allocation (e.g. "Water usage (proportional)" with the unit's amount).`
  : "- If NO submeter data is provided, output exactly ONE bill for the whole property using the extracted bill data."}
- amountDue and lineItems[].amount must be dollar strings (e.g. "$123.45").
- dateMailed and dateDue: use format from the document or MM/DD/YYYY.
- lineItems: at least one row per bill (e.g. "Water usage" or "Electric usage (allocated)" with the amount).`

    const userParts = [`Extracted bill data from the utility bill:\n\n${extractedBlock}`]
    if (hasSubmeter) {
      userParts.push(`\n\nSubmeter data (per-unit usage; create one bill per unit and allocate the bill total proportionally):\n\n${submeterData!.trim()}`)
    }
    userParts.push("\n\nOutput ONLY the JSON object with a \"bills\" array. No other text.")
    const userMessage = userParts.join("")

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    })

    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      return NextResponse.json({ error: "No response from the model." }, { status: 502 })
    }

    let parsed: { bills?: unknown[] }
    try {
      parsed = JSON.parse(raw) as { bills?: unknown[] }
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON. Try analyzing the bill again." },
        { status: 502 }
      )
    }

    const bills = Array.isArray(parsed.bills) ? parsed.bills : []
    const structured: StructuredBill[] = bills.map((b: any) => ({
      accountNumber: String(b?.accountNumber ?? "—").trim(),
      serviceFor: String(b?.serviceFor ?? "—").trim(),
      serviceAddress: String(b?.serviceAddress ?? "—").trim(),
      dateMailed: String(b?.dateMailed ?? "—").trim(),
      dateDue: String(b?.dateDue ?? "—").trim(),
      amountDue: String(b?.amountDue ?? "—").trim(),
      previousBalance: b?.previousBalance != null ? String(b.previousBalance).trim() : undefined,
      paymentReceived: b?.paymentReceived != null ? String(b.paymentReceived).trim() : undefined,
      currentCharges: b?.currentCharges != null ? String(b.currentCharges).trim() : undefined,
      totalChargesThisMonth: b?.totalChargesThisMonth != null ? String(b.totalChargesThisMonth).trim() : undefined,
      lineItems: Array.isArray(b?.lineItems)
        ? b.lineItems.map((row: any) => ({
            description: String(row?.description ?? "").trim(),
            quantity: row?.quantity != null ? String(row.quantity).trim() : undefined,
            rate: row?.rate != null ? String(row.rate).trim() : undefined,
            amount: String(row?.amount ?? "").trim(),
          }))
        : [],
    }))

    return NextResponse.json({ bills: structured })
  } catch (e: unknown) {
    console.error("Generate bills error:", e)
    const err = e as { message?: string }
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate bills." },
      { status: 500 }
    )
  }
}
