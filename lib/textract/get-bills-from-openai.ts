import OpenAI from "openai"
import { parseBillFromExtracted, getTotalFromExtracted } from "./parse-bill-from-extracted"

export interface SubmeterUnit {
  label: string
  usage: number
}

/** Use ChatGPT to parse raw spreadsheet/CSV submeter data into unit + reading. Handles any layout. */
async function getUnitsFromSubmeterDataViaOpenAI(
  openai: OpenAI,
  submeterData: string
): Promise<SubmeterUnit[]> {
  const prompt = `You are parsing submeter/utility reading data from a spreadsheet or CSV.

Below is raw data (pasted or exported from Excel). It may have multiple tabs/sections, many columns, headers, addresses, unit numbers, and meter readings.

Your task: Find the CURRENT or RELEVANT meter reading for EACH unit that should receive its own bill. For example for "409 South Grape Street" you might see Unit 409 and Unit 415 each with a water reading — you must return ONE object per unit (so 2 objects for 2 units).

Rules:
- Return a JSON object with a "units" array. Each item: { "label": "Unit 409", "usage": 428.995 }
- You MUST return one object per unit that has a meter reading. If the data shows 2 units (e.g. Unit 409 and Unit 415), return exactly 2 objects with their respective readings. Do not combine multiple units into one.
- "label" = unit identifier (e.g. "Unit 409", "409", "Unit 415").
- "usage" = the numeric meter reading for that unit (e.g. 428.995, 2987.57). Use the current/latest reading if there are multiple (e.g. previous vs current). Use water or the main utility reading if there are several.
- If a unit has multiple readings (water, power, gas), use the one that matches the bill being split (typically water).
- Numbers can have commas (2,987.57) or decimals (428.995). Return numeric values only.
- If you cannot find any readings, return { "units": [] }.

Raw submeter data:

${submeterData.trim().slice(0, 15000)}

Output ONLY valid JSON: { "units": [ { "label": "string", "usage": number }, ... ] }. No other text.`
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no explanation." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2048,
  })
  const raw = completion.choices?.[0]?.message?.content?.trim()
  if (!raw) return []
  const parsed = JSON.parse(raw) as { units?: { label?: string; usage?: number }[] }
  const arr = Array.isArray(parsed.units) ? parsed.units : []
  const filtered = arr.filter(
    (u) => u != null && typeof u.usage === "number" && Number.isFinite(u.usage) && u.usage >= 0
  )
  return filtered.map((u, i) => ({
    label: String(u?.label ?? "").trim() || `Unit ${i + 1}`,
    usage: Number(u!.usage),
  }))
}

export interface BillMetadata {
  propertyAddress?: string
  owner?: string
  waterUtility?: string
  powerUtility?: string
  gasUtility?: string
  billingPeriod?: string
  numberOfUnits?: string
}

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
  propertyAddress?: string
  owner?: string
  waterUtility?: string
  powerUtility?: string
  gasUtility?: string
  billingPeriod?: string
  numberOfUnits?: string
}

function formatMoney(n: number): string {
  return "$" + n.toFixed(2)
}

/** Charges that are split equally among tenants (not by usage). Use exact bill names. */
const EQUAL_SPLIT_PATTERNS = [
  "monthly water service charge",
  "monthly trash & recycling",
  "monthly trash and recycling",
  "trash & recycling",
  "monthly wastewater service charge",
  "wastewater service charge",
]

function normalizeDesc(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

/** True if this line should be split equally among tenants; false = split proportionally by submeter usage. */
function isEqualSplitCharge(description: string): boolean {
  const d = normalizeDesc(description)
  return EQUAL_SPLIT_PATTERNS.some((p) => d.includes(p) || d === p)
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

function formatExtracted(extracted: {
  keyValuePairs: Record<string, string>
  tables: string[][][]
  text: string
}): string {
  const lines: string[] = []
  if (Object.keys(extracted.keyValuePairs).length > 0) {
    for (const [k, v] of Object.entries(extracted.keyValuePairs)) {
      lines.push(`  ${k}: ${v}`)
    }
  }
  if (extracted.tables.length > 0) {
    extracted.tables.forEach((table) => {
      table.forEach((row) => lines.push("  " + row.join(" | ")))
    })
  }
  if (extracted.text?.trim()) {
    lines.push(extracted.text.slice(0, 6000))
  }
  return lines.join("\n")
}

/** Use ChatGPT to extract property/utility metadata from bill + submeter spreadsheet (and optional Invoice_Template). */
async function getBillMetadataViaOpenAI(
  openai: OpenAI,
  extractedData: { keyValuePairs: Record<string, string>; tables: string[][][]; text: string },
  submeterData: string,
  invoiceTemplateContent?: string
): Promise<BillMetadata> {
  const billBlock = formatExtracted(extractedData).slice(0, 8000)
  const templateSection = invoiceTemplateContent?.trim()
    ? `\n\n--- INVOICE TEMPLATE (fields/layout to include on each bill) ---\n${invoiceTemplateContent.trim().slice(0, 6000)}\n--- END TEMPLATE ---`
    : ""
  const prompt = `You have two sources of information:
1) Data extracted from a UTILITY BILL (account, dates, amounts, charges).
2) A PROPERTY SUBMETERING spreadsheet (property address, owner, # of units, water/power/gas utility names, unit info, readings).${templateSection ? "\n3) An INVOICE_TEMPLATE sheet showing what fields should appear on each invoice." : ""}

Extract the following for use on each unit's invoice. Return ONLY valid JSON. Use "—" or leave empty if not found.

{
  "propertyAddress": "full property address from the spreadsheet (e.g. 409 South Grape Street Escondido, CA 92025)",
  "owner": "owner name from spreadsheet",
  "waterUtility": "water utility company name (e.g. Escondido Water)",
  "powerUtility": "power/electric utility (e.g. SDG&E)",
  "gasUtility": "gas utility if any",
  "billingPeriod": "billing period from bill or spreadsheet (e.g. 1/16/2026 - 1/31/2026 or Jan-26)",
  "numberOfUnits": "number of units from spreadsheet"
}

Utility bill data (excerpt):
${billBlock}

Submeter/property spreadsheet data:
${submeterData.trim().slice(0, 10000)}
${templateSection}

Output ONLY valid JSON with the keys above. No other text.`
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no explanation." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  })
  const raw = completion.choices?.[0]?.message?.content?.trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return {
      propertyAddress: typeof parsed.propertyAddress === "string" ? parsed.propertyAddress.trim() || undefined : undefined,
      owner: typeof parsed.owner === "string" ? parsed.owner.trim() || undefined : undefined,
      waterUtility: typeof parsed.waterUtility === "string" ? parsed.waterUtility.trim() || undefined : undefined,
      powerUtility: typeof parsed.powerUtility === "string" ? parsed.powerUtility.trim() || undefined : undefined,
      gasUtility: typeof parsed.gasUtility === "string" ? parsed.gasUtility.trim() || undefined : undefined,
      billingPeriod: typeof parsed.billingPeriod === "string" ? parsed.billingPeriod.trim() || undefined : undefined,
      numberOfUnits: typeof parsed.numberOfUnits === "string" ? parsed.numberOfUnits.trim() : undefined,
    }
  } catch {
    return {}
  }
}

/** Use ChatGPT to extract full charge breakdown from bill data (so we can show more than "Current charges"). */
async function getBillLineItemsViaOpenAI(
  openai: OpenAI,
  extractedData: { keyValuePairs: Record<string, string>; tables: string[][][]; text: string }
): Promise<{ description: string; amount: number }[]> {
  const block = formatExtracted(extractedData)
  const prompt = `Below is data extracted from a utility bill (key-value pairs, tables, and/or raw text).

Your task: List every charge line that appears on the bill with its EXACT description and amount from the bill.

CRITICAL RULES:
- Do NOT merge different charge lines. Each row on the bill = one line item. For example if there are two water usage lines ($65.57 and $25.55), return TWO separate items with their exact descriptions (e.g. "12/09/25 - 12/31/25 6.6774 KGals of water (Tier 1 @ $9.82 per thousand)" and "01/01/26 - 01/08/26 2.3226 KGals of water (Tier 1 @ $11.00 per thousand)").
- Use the EXACT charge names from the bill for these three fixed charges (they will be split equally among tenants): "Monthly Water Service Charge", "Monthly Trash & Recycling", "Monthly Wastewater Service Charge". Do not rename or shorten them.
- Actual water usage charges (e.g. KGals of water, Tier 1, per thousand) = separate lines, one per row on the bill. These will be split by usage.
- "description" = exact or near-exact charge name from the bill. "amount" = numeric amount only (no $).
- If you cannot find a breakdown, return one line: { "description": "Current charges", "amount": <total> }.

Return a JSON object: { "lineItems": [ { "description": "Monthly Water Service Charge", "amount": 67.58 }, { "description": "Monthly Trash & Recycling", "amount": 65.74 }, { "description": "Monthly Wastewater Service Charge", "amount": 124.45 }, { "description": "12/09/25 - 12/31/25 6.6774 KGals of water (Tier 1 @ $9.82 per thousand)", "amount": 65.57 }, { "description": "01/01/26 - 01/08/26 2.3226 KGals of water (Tier 1 @ $11.00 per thousand)", "amount": 25.55 }, ... ] }

Bill data:

${block.slice(0, 12000)}

Output ONLY valid JSON: { "lineItems": [ { "description": "string", "amount": number }, ... ] }. No other text.`
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no explanation." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2048,
  })
  const raw = completion.choices?.[0]?.message?.content?.trim()
  if (!raw) return []
  const parsed = JSON.parse(raw) as { lineItems?: { description?: string; amount?: number }[] }
  const arr = Array.isArray(parsed.lineItems) ? parsed.lineItems : []
  return arr
    .filter((li) => li != null && li.description != null && typeof li.amount === "number" && Number.isFinite(li.amount))
    .map((li) => ({
      description: String(li!.description).trim() || "Charge",
      amount: Number(li!.amount),
    }))
}

export async function getBillsFromOpenAI(
  openai: OpenAI,
  extractedData: { keyValuePairs: Record<string, string>; tables: string[][][]; text: string },
  submeterData?: string,
  invoiceTemplateContent?: string
): Promise<StructuredBill[]> {
  const hasSubmeter = Boolean(submeterData?.trim())

  // When user provided submeter data: use ChatGPT to parse readings, line items, and metadata; then we do proportional split in code.
  if (hasSubmeter) {
    const [units, chatLineItems, metadata] = await Promise.all([
      getUnitsFromSubmeterDataViaOpenAI(openai, submeterData!),
      getBillLineItemsViaOpenAI(openai, extractedData),
      getBillMetadataViaOpenAI(openai, extractedData, submeterData!, invoiceTemplateContent?.trim()),
    ])
    let parsed = parseBillFromExtracted(extractedData)
    const totalFromExtracted = getTotalFromExtracted(extractedData)
    const hasRealLineItems = chatLineItems.length > 1 || (chatLineItems.length === 1 && chatLineItems[0]!.description.toLowerCase() !== "current charges")
    if (units.length > 0) {
      if (!parsed || parsed.totalDue <= 0) {
        const total = totalFromExtracted ?? chatLineItems.reduce((s, li) => s + li.amount, 0)
        if (total > 0) {
          parsed = {
            totalDue: total,
            lineItems: hasRealLineItems ? chatLineItems : [{ description: "Current charges", amount: total }],
            accountNumber: parsed?.accountNumber ?? "—",
            serviceAddress: parsed?.serviceAddress ?? "—",
            dateMailed: parsed?.dateMailed ?? "—",
            dateDue: parsed?.dateDue ?? "—",
          }
        }
      } else if (parsed.lineItems.length <= 1 && hasRealLineItems) {
        parsed = { ...parsed, lineItems: chatLineItems }
      }
    }

    if (units.length === 0) {
      throw new Error(
        "No unit readings were found in the submeter data. Check that the pasted or uploaded data includes unit identifiers and meter readings (e.g. Unit 409, Unit 415 with water readings)."
      )
    }
    if (!parsed || parsed.totalDue <= 0) {
      throw new Error(
        "Could not read the bill total from the extracted bill. Check that the bill was analyzed and shows an amount due."
      )
    }

    const totalUsage = units.reduce((s, u) => s + u.usage, 0)
    if (totalUsage <= 0) {
      throw new Error(
        "Submeter usage values are missing or zero. Use a column with actual readings (e.g. Current Reading)."
      )
    }

    const n = units.length
    const proportions = units.map((u) => u.usage / totalUsage)

    // Split charges: proportional (by submeter usage) vs equal (by tenant count)
    const proportionalItems = parsed!.lineItems.filter((li) => !isEqualSplitCharge(li.description))
    const equalItems = parsed!.lineItems.filter((li) => isEqualSplitCharge(li.description))

    const proportionalTotal = proportionalItems.reduce((s, li) => s + li.amount, 0)
    const equalTotal = equalItems.reduce((s, li) => s + li.amount, 0)

    const amountsDue = units.map((_, i) => {
      const propShare = proportionalTotal * proportions[i]!
      const equalShare = n > 0 ? equalTotal / n : 0
      return Math.round((propShare + equalShare) * 100) / 100
    })
    const sumRounded = amountsDue.reduce((s, a) => s + a, 0)
    const diff = Math.round((parsed!.totalDue - sumRounded) * 100) / 100
    if (diff !== 0 && amountsDue.length > 0) amountsDue[amountsDue.length - 1]! += diff

    const bills: StructuredBill[] = units.map((unit, i) => {
      const proportion = proportions[i]!
      const amountDue = amountsDue[i]!

      const proportionalLines = proportionalItems.map((li) => ({
        description: li.description,
        quantity: undefined as string | undefined,
        rate: undefined as string | undefined,
        amount: formatMoney(Math.round(li.amount * proportion * 100) / 100),
      }))
      const equalLines = equalItems.map((li) => ({
        description: li.description,
        quantity: undefined as string | undefined,
        rate: undefined as string | undefined,
        amount: formatMoney(Math.round((li.amount / n) * 100) / 100),
      }))
      const lineItems = [...proportionalLines, ...equalLines]

      return {
        accountNumber: parsed!.accountNumber,
        serviceFor: unit.label,
        serviceAddress: parsed!.serviceAddress ?? metadata?.propertyAddress,
        dateMailed: parsed!.dateMailed,
        dateDue: parsed!.dateDue,
        amountDue: formatMoney(amountDue),
        lineItems,
        propertyAddress: metadata?.propertyAddress,
        owner: metadata?.owner,
        waterUtility: metadata?.waterUtility,
        powerUtility: metadata?.powerUtility,
        gasUtility: metadata?.gasUtility,
        billingPeriod: metadata?.billingPeriod,
        numberOfUnits: metadata?.numberOfUnits,
      }
    })
    return bills
  }

  const extractedBlock = formatExtracted(extractedData)

  const systemPrompt = `You are a bill formatter for Coast Metering. Output ONLY valid JSON with a "bills" array. Schema:
${BILLS_JSON_SCHEMA}

Rules:
- From the extracted BILL data, get total amount due, dates, service address, account info.
${hasSubmeter
  ? `- SUBMETER DATA gives per-unit usage. Each unit's share = (unit usage / total usage) × bill total. Create ONE bill per unit/row.`
  : "- No submeter data: output exactly ONE bill for the whole property."}
- amountDue and lineItems[].amount: dollar strings (e.g. "$123.45").
- lineItems: at least one row per bill.`

  const userParts = [`Extracted bill data:\n\n${extractedBlock}`]
  if (hasSubmeter) {
    userParts.push(`\n\nSubmeter data (per-unit usage; allocate proportionally):\n\n${submeterData!.trim()}`)
  }
  userParts.push('\n\nOutput ONLY the JSON object with a "bills" array. No other text.')

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userParts.join("") },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  })

  const raw = completion.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("No response from the model.")

  const parsed = JSON.parse(raw) as { bills?: unknown[] }
  const bills = Array.isArray(parsed.bills) ? parsed.bills : []

  return bills.map((b: any) => ({
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
}
