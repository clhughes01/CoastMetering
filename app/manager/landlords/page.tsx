"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building2, Mail, Phone, Loader2, Users } from "lucide-react"

const BASE = "/manager"

type TenantRow = {
  id: string
  name: string
  email: string | null
  move_out_date: string | null
}

type UnitRow = {
  id: string
  unit_number: string
  tenants: TenantRow[] | null
}

type PropertyRow = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  units?: UnitRow[] | null
}

type LandlordWithProperties = {
  id: string
  email: string
  name: string | null
  phone: string | null
  properties: PropertyRow[]
}

type ApiResponse = {
  success: boolean
  data: LandlordWithProperties[]
  unassignedProperties: PropertyRow[]
}

export default function ManagerLandlordsPage() {
  const [landlords, setLandlords] = useState<LandlordWithProperties[]>([])
  const [unassigned, setUnassigned] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingPropertyId, setUpdatingPropertyId] = useState<string | null>(null)
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/admin/landlords")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load Landlords")
      }
      const json: ApiResponse = await res.json()
      setLandlords(json.data || [])
      setUnassigned(json.unassignedProperties || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setLandlords([])
      setUnassigned([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatAddress = (p: { address?: string | null; city?: string | null; state?: string | null; zip_code?: string | null }) => {
    const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
  }

  const setPropertyLandlord = async (propertyId: string, landlordId: string | null) => {
    setUpdatingPropertyId(propertyId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/landlord`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landlordId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update")
      }
      setAssignSelection((prev) => ({ ...prev, [propertyId]: "" }))
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setUpdatingPropertyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Landlords" basePath={BASE} />
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading Landlords...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Landlords"
        breadcrumbs={[{ label: "Landlords" }]}
        basePath={BASE}
      />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {unassigned.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Properties without a landlord
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Assign a landlord below so they can view the property and its tenants (read-only).
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {unassigned.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground min-w-0 flex-1">
                      {formatAddress(p)}
                    </span>
                    <Select
                      value={assignSelection[p.id] ?? ""}
                      onValueChange={(v) =>
                        setAssignSelection((prev) => ({ ...prev, [p.id]: v }))
                      }
                    >
                      <SelectTrigger className="w-[200px]" size="sm">
                        <SelectValue placeholder="Select landlord" />
                      </SelectTrigger>
                      <SelectContent>
                        {landlords.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name || l.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={
                        !assignSelection[p.id] || updatingPropertyId === p.id
                      }
                      onClick={() =>
                        setPropertyLandlord(p.id, assignSelection[p.id] || null)
                      }
                    >
                      {updatingPropertyId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Assign"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Landlords and their properties
          </h2>
          {landlords.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  No landlords found. Generate a landlord invite code in Settings to create one.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {landlords.map((landlord) => (
                <Card key={landlord.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {landlord.name || landlord.email}
                    </CardTitle>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {landlord.email}
                      </span>
                      {landlord.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {landlord.phone}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground mb-2">
                      Properties ({landlord.properties.length})
                    </p>
                    {landlord.properties.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No properties assigned.</p>
                    ) : (
                      <ul className="space-y-1">
                        {landlord.properties.map((p) => (
                          <li key={p.id} className="flex items-center gap-2 text-sm flex-wrap">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="min-w-0">{formatAddress(p)}</span>
                            {p.units && p.units.length > 0 && (
                              <span className="text-muted-foreground">
                                · {p.units.length} unit{p.units.length !== 1 ? "s" : ""}
                                {" · "}
                                {p.units.reduce(
                                  (sum, u) => sum + (u.tenants?.filter((t) => !t.move_out_date).length ?? 0),
                                  0
                                )}{" "}
                                tenant(s)
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              disabled={updatingPropertyId === p.id}
                              onClick={() => setPropertyLandlord(p.id, null)}
                            >
                              {updatingPropertyId === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Unassign"
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
