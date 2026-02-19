"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DollarSign, Receipt, ImagePlus, Loader2, ChevronDown, ChevronUp, Camera, Trash2, X } from "lucide-react"

export type BillRow = {
  id: string
  accountNumber: string
  residentName: string
  periodLabel: string
  totalAmount: number
  amountPaid: number
  amountOwed: number
  status: "fully_paid" | "partial" | "unpaid"
  dueDate: string | null
  createdAt: string
  enteredByName: string | null
  propertyId: string | null
  propertyLabel: string | null
}

export type BillsSummary = {
  totalBill: number
  totalPaid: number
  totalOwed: number
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function StatusBadge({ status }: { status: BillRow["status"] }) {
  switch (status) {
    case "fully_paid":
      return <Badge className="bg-green-600 text-white">Fully paid</Badge>
    case "partial":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Partial</Badge>
    default:
      return <Badge variant="outline" className="text-muted-foreground">Unpaid</Badge>
  }
}

export function PaymentsTab({ managerId, propertyId }: { managerId?: string; propertyId?: string } = {}) {
  const [bills, setBills] = useState<BillRow[]>([])
  const [summary, setSummary] = useState<BillsSummary>({ totalBill: 0, totalPaid: 0, totalOwed: 0 })
  const [loading, setLoading] = useState(true)
  const [addPaymentBillId, setAddPaymentBillId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentFileList, setPaymentFileList] = useState<File[]>([])
  const paymentFileInputRef = React.useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraVideoRef = React.useRef<HTMLVideoElement>(null)
  const cameraStreamRef = React.useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState("")
  const [cameraCapturing, setCameraCapturing] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentError, setPaymentError] = useState("")
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const [paymentsByBill, setPaymentsByBill] = useState<Record<string, { id: string; amount: number; paid_at: string; receipt_urls: string[]; notes: string | null }[]>>({})
  const [addBillOpen, setAddBillOpen] = useState(false)
  const [newBill, setNewBill] = useState({ accountNumber: "", residentName: "", periodMonth: new Date().getMonth() + 1, periodYear: new Date().getFullYear(), totalAmount: "", propertyId: "" })
  const [addBillSubmitting, setAddBillSubmitting] = useState(false)
  const [addBillError, setAddBillError] = useState("")
  const [properties, setProperties] = useState<{ id: string; address: string; city: string; state: string; zip_code: string }[]>([])
  const [removingBillId, setRemovingBillId] = useState<string | null>(null)

  const loadBills = async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams()
      if (managerId) qs.set("manager", managerId)
      if (propertyId) qs.set("property", propertyId)
      const query = qs.toString()
      const res = await fetch(`/api/payments/bills${query ? `?${query}` : ""}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBills([])
        return
      }
      setBills(data.bills || [])
      setSummary(data.summary || { totalBill: 0, totalPaid: 0, totalOwed: 0 })
    } catch (e) {
      setBills([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBills()
  }, [managerId, propertyId])

  useEffect(() => {
    fetch("/api/properties/list")
      .then((r) => r.json())
      .then((d) => setProperties(d?.data ?? []))
      .catch(() => setProperties([]))
  }, [])

  const loadPaymentsForBill = async (billId: string) => {
    const res = await fetch(`/api/payments/bills/${billId}/payments`)
    const data = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(data.payments)) {
      setPaymentsByBill((prev) => ({ ...prev, [billId]: data.payments }))
    }
  }

  const openAddPayment = (billId: string) => {
    setAddPaymentBillId(billId)
    setPaymentAmount("")
    setPaymentNotes("")
    setPaymentFileList([])
    setPaymentError("")
  }

  const addPaymentFiles = (files: FileList | null) => {
    if (!files?.length) return
    setPaymentFileList((prev) => [...prev, ...Array.from(files)])
  }

  const removePaymentFile = (index: number) => {
    setPaymentFileList((prev) => prev.filter((_, i) => i !== index))
  }

  const openCamera = () => {
    setCameraError("")
    setCameraOpen(true)
  }

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
    }
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraOpen(false)
  }

  const startCameraStream = async () => {
    if (!cameraVideoRef.current) return
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      cameraStreamRef.current = stream
      cameraVideoRef.current.srcObject = stream
      setCameraError("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera access failed"
      setCameraError(msg)
    }
  }

  useEffect(() => {
    if (!cameraOpen) return
    const t = setTimeout(() => startCameraStream(), 100)
    return () => {
      clearTimeout(t)
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop())
        cameraStreamRef.current = null
      }
    }
  }, [cameraOpen])

  const capturePhoto = () => {
    const video = cameraVideoRef.current
    if (!video || !video.videoWidth) return
    setCameraCapturing(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (!blob) return
          const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" })
          setPaymentFileList((prev) => [...prev, file])
          closeCamera()
        },
        "image/jpeg",
        0.92
      )
    } finally {
      setCameraCapturing(false)
    }
  }

  const submitPayment = async () => {
    if (!addPaymentBillId) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      setPaymentError("Enter a valid amount.")
      return
    }
    setPaymentSubmitting(true)
    setPaymentError("")
    try {
      const form = new FormData()
      form.set("amount", paymentAmount)
      if (paymentNotes) form.set("notes", paymentNotes)
      for (const file of paymentFileList) {
        form.append("receipt", file)
      }
      const res = await fetch(`/api/payments/bills/${addPaymentBillId}/payments`, {
        method: "POST",
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPaymentError(data.error || "Failed to record payment.")
        return
      }
      const billId = addPaymentBillId
      setAddPaymentBillId(null)
      setPaymentFileList([])
      await loadBills()
      if (billId) await loadPaymentsForBill(billId)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const submitNewBill = async () => {
    const amount = parseFloat(newBill.totalAmount)
    if (!newBill.accountNumber.trim() || !newBill.residentName.trim() || isNaN(amount) || amount < 0) {
      setAddBillError("Account #, resident name, and a valid total amount are required.")
      return
    }
    setAddBillSubmitting(true)
    setAddBillError("")
    try {
      const res = await fetch("/api/payments/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: newBill.accountNumber.trim(),
          residentName: newBill.residentName.trim(),
          periodMonth: newBill.periodMonth,
          periodYear: newBill.periodYear,
          totalAmount: amount,
          propertyId: newBill.propertyId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAddBillError(data.error || "Failed to create bill.")
        return
      }
      setAddBillOpen(false)
      setNewBill({ accountNumber: "", residentName: "", periodMonth: new Date().getMonth() + 1, periodYear: new Date().getFullYear(), totalAmount: "", propertyId: "" })
      await loadBills()
    } finally {
      setAddBillSubmitting(false)
    }
  }

  const removeBill = async (billId: string) => {
    if (!confirm("Remove this bill completely? All payment records and receipt images for this bill will be deleted. This cannot be undone.")) return
    setRemovingBillId(billId)
    try {
      const res = await fetch(`/api/payments/bills/${billId}`, { method: "DELETE" })
      if (res.ok) {
        setExpandedBillId((id) => (id === billId ? null : id))
        await loadBills()
      }
    } finally {
      setRemovingBillId(null)
    }
  }

  const toggleExpanded = (billId: string) => {
    if (expandedBillId === billId) {
      setExpandedBillId(null)
      return
    }
    setExpandedBillId(billId)
    if (!paymentsByBill[billId]) loadPaymentsForBill(billId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total bill</p>
                <p className="text-2xl font-bold">{fmt(summary.totalBill)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total amount owed</p>
                <p className="text-2xl font-bold">{fmt(summary.totalOwed)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total paid</p>
                <p className="text-2xl font-bold text-green-600">{fmt(summary.totalPaid)}</p>
              </div>
              <Receipt className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bills table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Bills &amp; payments</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Record full or partial payments (e.g. cash) and attach receipt images. Amount owed updates as you add payments. All bills and payment history are stored in your database (bills and payment_records tables)—current and past periods stay in the same list.
            </p>
          </div>
          <Dialog open={addBillOpen} onOpenChange={setAddBillOpen}>
            <Button onClick={() => setAddBillOpen(true)}>Add bill</Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add bill</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {addBillError && <p className="text-sm text-destructive">{addBillError}</p>}
                <div>
                  <Label>Property</Label>
                  <Select
                    value={newBill.propertyId || ""}
                    onValueChange={(v) => setNewBill((b) => ({ ...b, propertyId: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {[p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean).join(", ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account number</Label>
                  <Input
                    value={newBill.accountNumber}
                    onChange={(e) => setNewBill((b) => ({ ...b, accountNumber: e.target.value }))}
                    placeholder="e.g. 1005"
                  />
                </div>
                <div>
                  <Label>Resident name</Label>
                  <Input
                    value={newBill.residentName}
                    onChange={(e) => setNewBill((b) => ({ ...b, residentName: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Month</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={newBill.periodMonth}
                      onChange={(e) => setNewBill((b) => ({ ...b, periodMonth: parseInt(e.target.value, 10) || 1 }))}
                    />
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={newBill.periodYear}
                      onChange={(e) => setNewBill((b) => ({ ...b, periodYear: parseInt(e.target.value, 10) || new Date().getFullYear() }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Total amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newBill.totalAmount}
                    onChange={(e) => setNewBill((b) => ({ ...b, totalAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddBillOpen(false)}>Cancel</Button>
                  <Button onClick={submitNewBill} disabled={addBillSubmitting}>
                    {addBillSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create bill"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {bills.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No bills yet.</p>
              <p className="text-sm mt-1">Click &quot;Add bill&quot; above to create a bill, then record full or partial payments with optional receipt images.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-medium">Account</th>
                    <th className="text-left p-3 font-medium">Resident</th>
                    <th className="text-left p-3 font-medium">Period</th>
                    <th className="text-right p-3 font-medium">Total bill</th>
                    <th className="text-right p-3 font-medium">Paid</th>
                    <th className="text-right p-3 font-medium">Owed</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Entered by</th>
                    <th className="text-left p-3 font-medium">Property</th>
                    <th className="p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="border-b border-border hover:bg-muted/20">
                        <td className="p-3">{row.accountNumber}</td>
                        <td className="p-3">{row.residentName}</td>
                        <td className="p-3">{row.periodLabel}</td>
                        <td className="p-3 text-right">{fmt(row.totalAmount)}</td>
                        <td className="p-3 text-right">{fmt(row.amountPaid)}</td>
                        <td className="p-3 text-right">{fmt(row.amountOwed)}</td>
                        <td className="p-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {row.enteredByName ?? "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs max-w-[180px] truncate" title={row.propertyLabel ?? undefined}>
                          {row.propertyLabel ?? "—"}
                        </td>
                        <td className="p-3">
                          <Dialog open={addPaymentBillId === row.id} onOpenChange={(open) => !open && setAddPaymentBillId(null)}>
                            <Button variant="outline" size="sm" onClick={() => openAddPayment(row.id)}>
                              Add payment
                            </Button>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Record payment</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  {row.residentName} — {row.periodLabel} (bill: {fmt(row.totalAmount)})
                                </p>
                                {paymentError && (
                                  <p className="text-sm text-destructive">{paymentError}</p>
                                )}
                                <div>
                                  <Label htmlFor="pay-amount">Amount ($)</Label>
                                  <Input
                                    id="pay-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="pay-notes">Notes (optional)</Label>
                                  <Input
                                    id="pay-notes"
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="e.g. Cash payment"
                                  />
                                </div>
                                <div>
                                  <Label className="flex items-center gap-2">
                                    <ImagePlus className="h-4 w-4" />
                                    Receipt image(s) (optional)
                                  </Label>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={openCamera}
                                    >
                                      <Camera className="h-4 w-4 mr-1" />
                                      Take photo
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => paymentFileInputRef.current?.click()}
                                    >
                                      <ImagePlus className="h-4 w-4 mr-1" />
                                      Upload file(s)
                                    </Button>
                                    <input
                                      ref={paymentFileInputRef}
                                      type="file"
                                      accept="image/*,.pdf"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => {
                                        addPaymentFiles(e.target.files)
                                        e.target.value = ""
                                      }}
                                    />
                                  </div>
                                  {paymentFileList.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {paymentFileList.map((file, i) => (
                                        <div
                                          key={i}
                                          className="relative inline-flex items-center gap-1 rounded border bg-muted/50 px-2 py-1 text-sm"
                                        >
                                          <span className="max-w-[120px] truncate">{file.name}</span>
                                          <button
                                            type="button"
                                            onClick={() => removePaymentFile(i)}
                                            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                            aria-label="Remove"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button variant="outline" onClick={() => setAddPaymentBillId(null)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={submitPayment} disabled={paymentSubmitting}>
                                    {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record payment"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          {/* Camera capture dialog */}
                          <Dialog open={cameraOpen} onOpenChange={(open) => !open && closeCamera()}>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Take a photo</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {cameraError ? (
                                  <p className="text-sm text-destructive">{cameraError}</p>
                                ) : (
                                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                                    <video
                                      ref={cameraVideoRef}
                                      autoPlay
                                      playsInline
                                      muted
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex gap-2 justify-end">
                                  <Button variant="outline" onClick={closeCamera}>
                                    Cancel
                                  </Button>
                                  <Button onClick={capturePhoto} disabled={!!cameraError || cameraCapturing}>
                                    {cameraCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                                    Capture
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1"
                            onClick={() => toggleExpanded(row.id)}
                          >
                            {expandedBillId === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-1"
                            onClick={() => removeBill(row.id)}
                            disabled={removingBillId === row.id}
                            aria-label="Remove bill"
                          >
                            {removingBillId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                      {expandedBillId === row.id && (
                        <tr className="bg-muted/20">
                          <td colSpan={10} className="p-4">
                            <PaymentHistory
                              billId={row.id}
                              payments={paymentsByBill[row.id] || []}
                              onRemove={async (paymentId) => {
                                const res = await fetch(`/api/payments/bills/${row.id}/payments/${paymentId}`, { method: "DELETE" })
                                if (res.ok) {
                                  await loadPaymentsForBill(row.id)
                                  await loadBills()
                                }
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentHistory({
  billId,
  payments,
  onRemove,
}: {
  billId: string
  payments: { id: string; amount: number; paid_at: string; receipt_urls: string[]; notes: string | null }[]
  onRemove: (paymentId: string) => Promise<void>
}) {
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null)

  const handleRemove = async (paymentId: string) => {
    if (!confirm("Remove this payment? The amount will be added back to the amount owed. Receipt images will be deleted.")) return
    setRemovingId(paymentId)
    try {
      await onRemove(paymentId)
    } finally {
      setRemovingId(null)
    }
  }

  const isPdf = (url: string) => url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("pdf")

  if (payments.length === 0) return <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Payment history</p>
      <ul className="list-none space-y-2 text-sm">
        {payments.map((p) => {
          const urls = (p.receipt_urls ?? []) as string[]
          return (
          <li key={p.id} className="flex items-center gap-2 flex-wrap">
            <span>{fmt(p.amount)}</span>
            <span className="text-muted-foreground">
              {new Date(p.paid_at).toLocaleDateString()}
              {p.notes ? ` — ${p.notes}` : ""}
            </span>
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted-foreground text-xs">Receipts:</span>
              {urls.length > 0 ? (
                urls.map((url, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewingReceiptUrl(url)}
                      className="text-primary hover:underline text-left"
                    >
                      View receipt {i + 1}
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:underline text-xs whitespace-nowrap">
                      (new tab)
                    </a>
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">None attached</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
              onClick={() => handleRemove(p.id)}
              disabled={removingId === p.id}
              aria-label="Remove payment"
            >
              {removingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Remove
            </Button>
          </li>
          )
        })}
      </ul>
      <Dialog open={!!viewingReceiptUrl} onOpenChange={(open) => !open && setViewingReceiptUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {viewingReceiptUrl && (
            <div className="flex-1 min-h-0 overflow-auto rounded-lg bg-muted/30 flex items-center justify-center p-2">
              {isPdf(viewingReceiptUrl) ? (
                <iframe src={viewingReceiptUrl} title="Receipt" className="w-full h-[70vh] rounded border-0" />
              ) : (
                <img src={viewingReceiptUrl} alt="Receipt" className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewingReceiptUrl(null)}>
              Close
            </Button>
            {viewingReceiptUrl && (
              <Button variant="secondary" asChild className="ml-2">
                <a href={viewingReceiptUrl} target="_blank" rel="noopener noreferrer">
                  Open in new tab
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
