import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getBillsFromOpenAI } from "@/lib/textract/get-bills-from-openai"
import { generateBillPDFBuffer } from "@/lib/utils/generate-bill-pdf-server"

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** Coast Metering bill template. When the user asks to create bills, the system generates PDFs and attaches them to this response. */
const COAST_METERING_BILL_TEMPLATE = `
Workflow: (1) User uploads the utility BILL and analyzes it with Textract. (2) User provides SUBMETER DATA (Excel or table) with per-unit usage. (3) When they ask you to "create the bills" or "generate the PDFs", the system will create one PDF per unit with amounts allocated proportionally (unit usage / total usage × bill total) and attach them to the reply. You can confirm that and tell them to check the downloads below.`

/** Build system prompt. */
function buildSystemPrompt(
  hasExtractedData: boolean,
  hasSubmeterData: boolean,
  templateDescription?: string
): string {
  const parts = [
    "You are an assistant for Coast Metering, a utility submetering company.",
    "Workflow: Staff upload the property's UTILITY BILL and analyze it with Textract (that gives the total due, dates, etc.). They also provide SUBMETER DATA—an Excel or table showing each unit's usage (e.g. water in gallons or electric in kWh). Your job is to combine these: use the bill total and allocate it across units by proportion (unit usage / total usage × bill total) so each tenant gets one bill.",
    hasExtractedData
      ? "The next user message will contain the extracted BILL data from Textract. Use it for the total amount due, dates, and account/address info."
      : "If no bill has been analyzed yet, ask them to upload the bill and click 'Analyze Document' first.",
    hasSubmeterData
      ? "The user has also provided submeter data (per-unit usage). Use it to determine how many bills to create and each unit's proportional share of the total."
      : "If they have multiple units, remind them they can paste or upload Excel submeter data so the system can create one bill per unit.",
    "When the user asks to create or generate the bills, the system will generate the PDFs and attach them to your reply. Tell them their bills are ready to download below.",
  ]
  parts.push("\n" + (templateDescription ?? COAST_METERING_BILL_TEMPLATE))
  return parts.join("\n\n")
}

/** Format extracted data for the model. */
function formatExtractedContext(extracted: {
  keyValuePairs: Record<string, string>
  tables: string[][][]
  text: string
}): string {
  const lines: string[] = ["--- EXTRACTED BILL DATA (from Textract) ---"]
  if (Object.keys(extracted.keyValuePairs).length > 0) {
    lines.push("\nKey-value pairs:")
    for (const [k, v] of Object.entries(extracted.keyValuePairs)) {
      lines.push(`  ${k}: ${v}`)
    }
  }
  if (extracted.tables.length > 0) {
    lines.push("\nTables:")
    extracted.tables.forEach((table, i) => {
      lines.push(`Table ${i + 1}:`)
      table.forEach((row) => {
        lines.push("  " + row.join(" | "))
      })
    })
  }
  if (extracted.text?.trim()) {
    lines.push("\nRaw text:")
    lines.push(extracted.text.slice(0, 8000))
  }
  lines.push("\n--- END EXTRACTED DATA ---")
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
    const {
      messages,
      context,
      generatePdfs,
    }: {
      messages?: { role: "user" | "assistant" | "system"; content: string }[]
      context?: {
        extractedData?: { keyValuePairs: Record<string, string>; tables: string[][][]; text: string }
        submeterData?: string
        invoiceTemplateContent?: string
        templateDescription?: string
      }
      generatePdfs?: boolean
    } = body

    const hasExtractedData = Boolean(context?.extractedData)
    const hasSubmeterData = Boolean(context?.submeterData?.trim())

    // When user asks to create bills, generate PDFs via ChatGPT (OpenAI) + template and return them
    if (generatePdfs && hasExtractedData && openai) {
      if (!hasSubmeterData) {
        return NextResponse.json(
          { error: "Submeter data is required to create per-unit bills. Paste or upload the Excel sheet with unit readings, then try again." },
          { status: 400 }
        )
      }
      try {
        const bills = await getBillsFromOpenAI(
          openai,
          context!.extractedData!,
          context!.submeterData!,
          context?.invoiceTemplateContent
        )
        if (bills.length === 0) {
          return NextResponse.json(
            { error: "No bills were generated. Check the bill and submeter data." },
            { status: 400 }
          )
        }
        const dateStr = new Date().toISOString().slice(0, 10)
        const pdfs: { filename: string; base64: string }[] = []
        for (let i = 0; i < bills.length; i++) {
          const bill = bills[i]!
          const buffer = generateBillPDFBuffer(bill)
          const account = (bill.accountNumber || `bill-${i + 1}`).replace(/\s+/g, "-")
          pdfs.push({
            filename: `coast-metering-bill-${account}-${dateStr}.pdf`,
            base64: buffer.toString("base64"),
          })
        }
        const content = `I've created ${bills.length} bill${bills.length === 1 ? "" : "s"} from the bill and submeter data. Download ${bills.length === 1 ? "it" : "them"} below.`
        return NextResponse.json({ content, pdfs })
      } catch (e) {
        console.error("Generate PDFs in chat error:", e)
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Failed to generate bills." },
          { status: 500 }
        )
      }
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      )
    }

    const systemPrompt = buildSystemPrompt(hasExtractedData, hasSubmeterData, context?.templateDescription)

    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ]

    const contextParts: string[] = []
    if (context?.extractedData) {
      contextParts.push("[Extracted bill data from the utility bill just analyzed.]\n\n" + formatExtractedContext(context.extractedData))
    }
    if (hasSubmeterData) {
      contextParts.push("\n\n[Submeter data (per-unit usage) provided by the user.]\n\n" + context!.submeterData!.trim())
    }
    if (contextParts.length > 0) {
      apiMessages.push({
        role: "user",
        content: contextParts.join(""),
      })
    }

    apiMessages.push(
      ...messages
        .filter((m): m is { role: "user" | "assistant"; content: string } => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content }))
    )

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: apiMessages,
      max_tokens: 4096,
    })

    const choice = completion.choices?.[0]
    const content = choice?.message?.content?.trim() ?? ""

    if (!content) {
      return NextResponse.json(
        { error: "No response from the model" },
        { status: 502 }
      )
    }

    return NextResponse.json({ content })
  } catch (e: unknown) {
    console.error("Textract chat error:", e)
    const err = e as { message?: string; status?: number }
    const message = err?.message ?? "Chat request failed"
    const status = err?.status === 401 ? 401 : 500
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
