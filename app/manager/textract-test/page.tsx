"use client"

import { useState } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ExtractedData {
  keyValuePairs: Record<string, string>
  tables: string[][][]
  text: string
}

export default function TextractTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError("")
      setExtractedData(null)

      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
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
      formData.append('file', file)

      const response = await fetch('/api/textract/analyze', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        // Provide more detailed error message
        const errorMsg = result.error || result.details || 'Failed to analyze document'
        const hint = result.hint ? `\n\n${result.hint}` : ''
        throw new Error(errorMsg + hint)
      }

      setExtractedData(result.extracted)
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Dashboard" 
        breadcrumbs={[{ label: "Textract Test" }]} 
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
                Upload a water bill (PDF, PNG, or JPEG) to extract data using AWS Textract.
                This will be used to automatically process bills and generate statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload */}
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
                    Note: PDFs should be text-based. Scanned/image PDFs may not work - try converting to PNG/JPEG first.
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
                    <span>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
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
              </div>

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{error}</p>
                    {error.includes('Unsupported') && (
                      <div className="mt-2 text-sm space-y-1">
                        <p className="font-medium">Tips to fix:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Try converting the PDF to PNG or JPEG if it's a scanned document</li>
                          <li>Make sure the file is not password-protected</li>
                          <li>Ensure the file is not corrupted</li>
                          <li>For PDFs, use text-based PDFs (not image-only PDFs)</li>
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Extracted Data Display */}
              {extractedData && (
                <div className="space-y-6 pt-4 border-t border-border">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Extracted Data</h3>
                    
                    {/* Key-Value Pairs */}
                    {Object.keys(extractedData.keyValuePairs).length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="text-base">Key-Value Pairs</CardTitle>
                          <CardDescription>Extracted form fields and values</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(extractedData.keyValuePairs).map(([key, value]) => (
                              <div key={key} className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground">{key}</p>
                                <p className="text-base font-semibold text-foreground mt-1">{value || 'N/A'}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Tables */}
                    {extractedData.tables.length > 0 && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle className="text-base">Extracted Tables</CardTitle>
                          <CardDescription>Table data found in the document</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {extractedData.tables.map((table, tableIndex) => (
                            <div key={tableIndex} className="overflow-x-auto">
                              <table className="w-full border-collapse border border-border text-sm">
                                <tbody>
                                  {table.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                      {row.map((cell, cellIndex) => (
                                        <td 
                                          key={cellIndex}
                                          className={`border border-border p-2 ${
                                            rowIndex === 0 ? 'bg-muted font-medium' : ''
                                          }`}
                                        >
                                          {cell || ''}
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

                    {/* Raw Text */}
                    {extractedData.text && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Extracted Text</CardTitle>
                          <CardDescription>All text found in the document</CardDescription>
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
