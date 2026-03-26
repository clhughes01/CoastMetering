"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Droplets, Plus, Zap } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"

const BASE = "/admin"
const UTILITY_OPTIONS = [
  { key: "escondido_water", label: "Water (Escondido)", icon: Droplets },
  { key: "sdge_electric", label: "Electric (SDG&E)", icon: Zap },
] as const

type ProviderBill = {
  id: string
  property_id: string
  utility_key: string
  account_number: string
  billing_period_start: string
  billing_period_end: string
  amount_due: number
  due_date: string | null
  pdf_url: string | null
  fetched_at: string
}

type Property = { id: string; address?: string }

export default function AdminProviderBillsPage() {
  const [bills, setBills] = useState<ProviderBill[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [utilityFilter, setUtilityFilter] = useState<string>("")
  const [form, setForm] = useState({
    property_id: "",
    utility_key: "escondido_water",
    account_number: "",
    billing_period_start: "",
    billing_period_end: "",
    amount_due: "",
    due_date: "",
    pdf_url: "",
  })

  const loadBills = async () => {
    try {
      const res = await fetch("/api/admin/utility-provider-bills")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setBills(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bills")
    } finally {
      setLoading(false)
    }
  }

  const loadProperties = async () => {
    const supabase = createSupabaseClient()
    const { data } = await supabase.from("properties").select("id, address").order("address")
    setProperties((data as Property[]) ?? [])
  }

  useEffect(() => {
    loadBills()
    loadProperties()
  }, [])

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(form.amount_due)
    if (!form.property_id || !form.billing_period_start || !form.billing_period_end || Number.isNaN(amount) || amount < 0) {
      setError("Property, period start, period end, and amount are required.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/utility-provider-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: form.property_id,
          utility_key: form.utility_key,
          account_number: form.account_number || "manual",
          billing_period_start: form.billing_period_start,
          billing_period_end: form.billing_period_end,
          amount_due: amount,
          due_date: form.due_date || null,
          pdf_url: form.pdf_url || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to add bill")
      setForm({ property_id: "", utility_key: form.utility_key, account_number: "", billing_period_start: "", billing_period_end: "", amount_due: "", due_date: "", pdf_url: "" })
      setShowAdd(false)
      await loadBills()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add bill")
    } finally {
      setSubmitting(false)
    }
  }

  const propertyLabel = (id: string) => properties.find((p) => p.id === id)?.address || id.slice(0, 8)
  const utilityLabel = (key: string) => UTILITY_OPTIONS.find((u) => u.key === key as any)?.label ?? key

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Provider Bills" breadcrumbs={[{ label: "Provider Bills" }]} basePath={BASE} />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className="h-5 w-5 text-primary" />
              Utility provider bills
            </CardTitle>
            <Button onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4 mr-2" />
              Add bill manually
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Bills are fetched automatically on a schedule. You can also add a bill manually.</p>

            <div className="flex items-center gap-3">
              <div className="w-56">
                <Label>Filter utility</Label>
                <select
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={utilityFilter}
                  onChange={(e) => setUtilityFilter(e.target.value)}
                >
                  <option value="">All utilities</option>
                  {UTILITY_OPTIONS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showAdd && (
              <form onSubmit={handleAddBill} className="rounded-lg border p-4 space-y-4 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Utility</Label>
                    <select
                      required
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.utility_key}
                      onChange={(e) => setForm((f) => ({ ...f, utility_key: e.target.value }))}
                    >
                      {UTILITY_OPTIONS.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Property</Label>
                    <select
                      required
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.property_id}
                      onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                    >
                      <option value="">Select property</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.address || p.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Account number (optional)</Label>
                    <Input
                      placeholder="e.g. 12345"
                      value={form.account_number}
                      onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Billing period start</Label>
                    <Input
                      type="date"
                      required
                      value={form.billing_period_start}
                      onChange={(e) => setForm((f) => ({ ...f, billing_period_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Billing period end</Label>
                    <Input
                      type="date"
                      required
                      value={form.billing_period_end}
                      onChange={(e) => setForm((f) => ({ ...f, billing_period_end: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Amount due ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={form.amount_due}
                      onChange={(e) => setForm((f) => ({ ...f, amount_due: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Due date (optional)</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>PDF URL (optional)</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={form.pdf_url}
                    onChange={(e) => setForm((f) => ({ ...f, pdf_url: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save bill"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : bills.filter((b) => !utilityFilter || b.utility_key === utilityFilter).length === 0 ? (
              <p className="text-sm text-muted-foreground">No provider bills yet. Add one manually above or wait for the next automatic fetch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Utility</th>
                      <th className="text-left py-2">Property</th>
                      <th className="text-left py-2">Account</th>
                      <th className="text-left py-2">Period</th>
                      <th className="text-right py-2">Amount</th>
                      <th className="text-left py-2">Due date</th>
                      <th className="text-left py-2">Fetched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills
                      .filter((b) => !utilityFilter || b.utility_key === utilityFilter)
                      .map((b) => (
                      <tr key={b.id} className="border-b">
                        <td className="py-2">{utilityLabel(b.utility_key)}</td>
                        <td className="py-2">{propertyLabel(b.property_id)}</td>
                        <td className="py-2">{b.account_number}</td>
                        <td className="py-2">{b.billing_period_start} – {b.billing_period_end}</td>
                        <td className="py-2 text-right">${Number(b.amount_due).toFixed(2)}</td>
                        <td className="py-2">{b.due_date ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{b.fetched_at?.slice(0, 10) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
