"use client"

import { useState, useRef, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Upload, Loader2, CheckCircle2, AlertCircle, FileDown, MessageSquare, Send, Table } from "lucide-react"
import * as XLSX from "xlsx"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { generateBillPDF } from "@/lib/utils/generate-bill-pdf"
import {
  generateBillPDFFromStructured,
  loadImageAsDataUrl,
  type StructuredBillForPDF,
} from "@/lib/utils/generate-bill-pdf-from-structured"
import { cn } from "@/lib/utils"

const BASE = "/admin"

interface ExtractedData {
  keyValuePairs: Record<string, string>
  tables: string[][][]
  text: string
}

export default function AdminTextractTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<string | null>(null)

  // ChatGPT-style bill assistant
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string; pdfs?: { filename: string; base64: string }[] }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState("")
  const [includeExtractedInChat, setIncludeExtractedInChat] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [generatePdfLoading, setGeneratePdfLoading] = useState(false)
  const [generatePdfError, setGeneratePdfError] = useState("")
  const [submeterData, setSubmeterData] = useState("")
  const [excelSheets, setExcelSheets] = useState<{ name: string; csv: string }[] | null>(null)
  const [invoiceTemplateContent, setInvoiceTemplateContent] = useState<string | null>(null)
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError("")
      setExtractedData(null)
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(selectedFile)
      } else {
        setPreview(null)
      }
    }
  }

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }
    setLoading(true)
    setError("")
    setExtractedData(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/textract/analyze", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        const errorMsg =
          result.error || result.details || "Failed to analyze document"
        const hint = result.hint ? `\n\n${result.hint}` : ""
        throw new Error(errorMsg + hint)
      }
      setExtractedData(result.extracted)
    } catch (err: any) {
      setError(err.message || "An error occurred while analyzing the document")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBills = async () => {
    if (!extractedData || chatLoading) return
    setChatError("")
    setChatMessages((prev) => [...prev, { role: "user", content: "Create the bills from the current bill and submeter data." }])
    setChatLoading(true)
    try {
      const res = await fetch("/api/textract/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user" as const, content: "Create the bills." }],
          context: {
            extractedData,
            submeterData: submeterData.trim() || undefined,
            invoiceTemplateContent: invoiceTemplateContent?.trim() || undefined,
          },
          generatePdfs: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate bills.")
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.content, pdfs: data.pdfs }])
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setChatLoading(false)
    }
  }

  const handleSendChat = async () => {
    const trimmed = chatInput.trim()
    if (!trimmed || chatLoading) return
    setChatError("")
    const userMessage = { role: "user" as const, content: trimmed }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput("")
    setChatLoading(true)
    try {
      const messages = [...chatMessages, userMessage]
      const res = await fetch("/api/textract/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          context: {
            extractedData: includeExtractedInChat && extractedData ? extractedData : undefined,
            submeterData: submeterData.trim() || undefined,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to get response")
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.content, pdfs: data.pdfs }])
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setChatLoading(false)
    }
  }

  const handleCreatePDF = () => {
    if (!extractedData) return
    try {
      const blob = generateBillPDF(
        {
          keyValuePairs: extractedData.keyValuePairs,
          tables: extractedData.tables,
        },
        "bill.pdf"
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `coast-metering-bill-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setError("Failed to generate PDF. Make sure there is extracted data.")
    }
  }

  const handleGeneratePDFBills = async () => {
    if (!extractedData || generatePdfLoading) return
    setGeneratePdfError("")
    setGeneratePdfLoading(true)
    try {
      const res = await fetch("/api/textract/generate-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedData,
          submeterData: submeterData.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate bills.")
      }
      const bills = data.bills as StructuredBillForPDF[]
      if (!bills?.length) {
        throw new Error("No bills were generated. Try analyzing the bill again.")
      }
      let logoDataUrl: string | undefined
      try {
        logoDataUrl = await loadImageAsDataUrl("/images/coast-metering-logo.png")
      } catch {
        // no logo or failed to load; PDF will use text header
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      for (let i = 0; i < bills.length; i++) {
        const blob = generateBillPDFFromStructured(bills[i], logoDataUrl)
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const account = (bills[i].accountNumber || "bill").replace(/\s+/g, "-")
        a.download = `coast-metering-bill-${account}-${dateStr}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        if (i < bills.length - 1) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }
    } catch (err) {
      setGeneratePdfError(err instanceof Error ? err.message : "Failed to generate PDFs.")
    } finally {
      setGeneratePdfLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Extract Bill (Textract)"
        breadcrumbs={[{ label: "Textract Test" }]}
        basePath={BASE}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                AWS Textract Document Analysis
              </CardTitle>
              <CardDescription>
                Upload a water bill (PDF, PNG, or JPEG) to extract data using
                AWS Textract. This will be used to automatically process bills
                and generate statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Upload Bill Document</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    disabled={loading}
                    className="text-gray-900 bg-white"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PNG, JPEG, PDF (Max size: 10MB)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Note: PDFs should be text-based. Scanned/image PDFs may not
                    work - try converting to PNG/JPEG first.
                  </p>
                </div>

                {preview && (
                  <div className="border border-border rounded-lg p-4 bg-muted/30">
                    <p className="text-sm font-medium mb-2">Preview:</p>
                    <img
                      src={preview}
                      alt="Document preview"
                      className="max-w-full h-auto max-h-96 rounded border border-border"
                    />
                  </div>
                )}

                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>
                      Selected: {file.name} (
                      {(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleAnalyze}
                  disabled={!file || loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing Document...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Analyze Document
                    </>
                  )}
                </Button>

                <div className="space-y-2 pt-4 border-t border-border">
                  <Label className="flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    Submeter data (optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload an Excel file (.xlsx, .xls, .xlsm) or paste CSV with per-unit usage (e.g. Unit, Account, Usage). The bill total will be split proportionally—one PDF per unit when you create bills.
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="file"
                        accept=".xlsx,.xls,.xlsm,.csv"
                        className="w-auto text-sm"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            try {
                              const data = ev.target?.result
                              if (!data) return
                              const wb = XLSX.read(data, { type: "binary" })
                              const names = wb.SheetNames
                              if (!names.length) return
                              const isTemplateSheet = (n: string) =>
                                /invoice\s*template/i.test(n.trim())
                              let templateCsv: string | null = null
                              const dataSheets = names
                                .map((name) => {
                                  const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
                                  if (isTemplateSheet(name)) {
                                    templateCsv = csv
                                    return null
                                  }
                                  return { name, csv }
                                })
                                .filter((s): s is { name: string; csv: string } => s != null)
                              setInvoiceTemplateContent(templateCsv)
                              const sheets = dataSheets.length > 0 ? dataSheets : names.map((name) => ({ name, csv: XLSX.utils.sheet_to_csv(wb.Sheets[name]) }))
                              setExcelSheets(sheets)
                              setSelectedSheetIndex(0)
                              setSubmeterData(sheets[0]!.csv)
                              setGeneratePdfError("")
                            } catch {
                            setGeneratePdfError("Could not read Excel file.")
                            setExcelSheets(null)
                            setInvoiceTemplateContent(null)
                            }
                          }
                          reader.readAsBinaryString(f)
                          e.target.value = ""
                        }}
                      />
                      {excelSheets && excelSheets.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="sheet-select" className="text-sm text-muted-foreground whitespace-nowrap">
                            Use sheet:
                          </Label>
                          <select
                            id="sheet-select"
                            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            value={selectedSheetIndex}
                            onChange={(e) => {
                              const i = Number(e.target.value)
                              setSelectedSheetIndex(i)
                              setSubmeterData(excelSheets[i]!.csv)
                            }}
                          >
                            {excelSheets.map((s, i) => (
                              <option key={s.name} value={i}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    {excelSheets && excelSheets.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        This file has {excelSheets.length} tab(s). Select the tab that has the unit readings for this property.
                      </p>
                    )}
                    {invoiceTemplateContent && (
                      <p className="text-xs text-muted-foreground">
                        Invoice_Template sheet detected — bill layout and fields will be filled from the template, bill, and property data.
                      </p>
                    )}
                  </div>
                  <Textarea
                    placeholder="Paste CSV or table (e.g. Unit, Usage&#10;1005, 500&#10;1006, 300) or upload Excel above"
                    value={submeterData}
                    onChange={(e) => setSubmeterData(e.target.value)}
                    className="min-h-[100px] font-mono text-sm"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{error}</p>
                    {error.includes("Unsupported") && (
                      <div className="mt-2 text-sm space-y-1">
                        <p className="font-medium">Tips to fix:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>
                            Try converting the PDF to PNG or JPEG if it's a
                            scanned document
                          </li>
                          <li>Make sure the file is not password-protected</li>
                          <li>Ensure the file is not corrupted</li>
                          <li>
                            For PDFs, use text-based PDFs (not image-only PDFs)
                          </li>
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {extractedData && (
                <div className="space-y-6 pt-4 border-t border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-lg font-semibold">Extracted Data</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={handleCreateBills}
                        disabled={chatLoading || !extractedData || !submeterData.trim()}
                        variant="default"
                        className="w-full sm:w-auto"
                        title={!submeterData.trim() ? "Add submeter data (paste or upload Excel) first" : undefined}
                      >
                        {chatLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-2" />
                        )}
                        Create bills (ChatGPT + template)
                      </Button>
                      <Button
                        onClick={handleCreatePDF}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Quick PDF (raw data only)
                      </Button>
                    </div>
                  </div>
                  {generatePdfError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{generatePdfError}</AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground">
                    &quot;Create bills&quot; uses ChatGPT to turn the bill + submeter data into one PDF per unit (proportional amounts) with the Coast Metering logo and template. You can also ask in the chat below: &quot;Create the bills.&quot;
                  </p>
                  <div>
                    {Object.keys(extractedData.keyValuePairs).length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="text-base">
                            Key-Value Pairs
                          </CardTitle>
                          <CardDescription>
                            Extracted form fields and values
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(
                              extractedData.keyValuePairs
                            ).map(([key, value]) => (
                              <div
                                key={key}
                                className="p-3 bg-muted/30 rounded-lg"
                              >
                                <p className="text-sm font-medium text-muted-foreground">
                                  {key}
                                </p>
                                <p className="text-base font-semibold text-foreground mt-1">
                                  {value || "N/A"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {extractedData.tables.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="text-base">
                            Extracted Tables
                          </CardTitle>
                          <CardDescription>
                            Table data found in the document
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {extractedData.tables.map((table, tableIndex) => (
                            <div
                              key={tableIndex}
                              className="overflow-x-auto"
                            >
                              <table className="w-full border-collapse border border-border text-sm">
                                <tbody>
                                  {table.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                      {row.map((cell, cellIndex) => (
                                        <td
                                          key={cellIndex}
                                          className={`border border-border p-2 ${
                                            rowIndex === 0
                                              ? "bg-muted font-medium"
                                              : ""
                                          }`}
                                        >
                                          {cell || ""}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {extractedData.text && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Extracted Text
                          </CardTitle>
                          <CardDescription>
                            All text found in the document
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 bg-muted/30 rounded-lg max-h-96 overflow-y-auto">
                            <pre className="text-sm whitespace-pre-wrap font-mono">
                              {extractedData.text}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {/* Bill assistant chat widget */}
              <div className="pt-6 mt-6 border-t border-border">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <MessageSquare className="h-5 w-5" />
                  Bill assistant (ChatGPT)
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask the assistant to separate the bill by submeter or explain charges. For actual PDF bill(s), use the <strong>Generate PDF bill(s)</strong> button above (in Extracted Data)—it produces clean, template-formatted PDFs with the Coast Metering logo.
                </p>
                <Card className="border-2">
                  <CardContent className="p-0">
                    <div className="min-h-[280px] max-h-[420px] overflow-y-auto flex flex-col">
                      {chatMessages.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground flex-1 flex items-center justify-center text-center">
                          <p>
                            Example: &quot;Here is the bill for this property – can you separate it out based on the submetering for the month?&quot;
                            <br />
                            <span className="text-xs mt-2 block">Analyze a bill above, then type your question below.</span>
                          </p>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={cn(
                            "px-4 py-3 text-sm",
                            msg.role === "user"
                              ? "bg-primary/10 border-b border-border"
                              : "bg-muted/30 border-b border-border"
                          )}
                        >
                          <span className="font-medium text-muted-foreground block mb-1">
                            {msg.role === "user" ? "You" : "Assistant"}
                          </span>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                          {msg.pdfs && msg.pdfs.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {msg.pdfs.map((p, j) => (
                                <a
                                  key={j}
                                  href={`data:application/pdf;base64,${p.base64}`}
                                  download={p.filename}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                                >
                                  <FileDown className="h-4 w-4" />
                                  {p.filename}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="px-4 py-3 text-sm bg-muted/30 border-b border-border flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Thinking...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {chatError && (
                      <Alert variant="destructive" className="m-2 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{chatError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="p-3 border-t border-border space-y-2">
                      {extractedData && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={includeExtractedInChat}
                            onChange={(e) => setIncludeExtractedInChat(e.target.checked)}
                          />
                          Include current extracted bill data with each message
                        </label>
                      )}
                      <div className="flex gap-2 items-end">
                        <Textarea
                          placeholder="e.g. Here is the bill for this property – can you separate it out based on the submetering for the month?"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendChat()
                            }
                          }}
                          disabled={chatLoading}
                          className="min-h-[80px] resize-none flex-1"
                          rows={3}
                        />
                        <Button
                          onClick={handleSendChat}
                          disabled={!chatInput.trim() || chatLoading}
                          className="shrink-0"
                        >
                          {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                          Send
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
