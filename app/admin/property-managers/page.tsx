"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
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
import { Building2, UserCog, Mail, Phone, Loader2, DoorOpen, Users } from "lucide-react"

const BASE = "/admin"

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

type ManagerWithProperties = {
  id: string
  email: string
  name: string | null
  company_name: string | null
  phone: string | null
  properties: PropertyRow[]
}

type ApiResponse = {
  success: boolean
  data: ManagerWithProperties[]
  unassignedProperties: PropertyRow[]
}

export default function AdminPropertyManagersPage() {
  const searchParams = useSearchParams()
  const filterManagerId = searchParams.get("manager") || undefined
  const filterPropertyId = searchParams.get("property") || undefined

  const [managers, setManagers] = useState<ManagerWithProperties[]>([])
  const [unassigned, setUnassigned] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingPropertyId, setUpdatingPropertyId] = useState<string | null>(null)
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({})

  const filteredManagers = useMemo(() => {
    if (!filterManagerId && !filterPropertyId) return managers
    if (filterPropertyId) {
      const managerWithProperty = managers.find((m) =>
        m.properties.some((p) => p.id === filterPropertyId)
      )
      return managerWithProperty ? [managerWithProperty] : []
    }
    const one = managers.find((m) => m.id === filterManagerId)
    return one ? [one] : []
  }, [managers, filterManagerId, filterPropertyId])

  const filteredUnassigned = useMemo(() => {
    if (!filterManagerId && !filterPropertyId) return unassigned
    if (filterPropertyId) return unassigned.filter((p) => p.id === filterPropertyId)
    return unassigned
  }, [unassigned, filterManagerId, filterPropertyId])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/admin/property-managers")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load property managers")
      }
      const json: ApiResponse = await res.json()
      setManagers(json.data || [])
      setUnassigned(json.unassignedProperties || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setManagers([])
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

  const setPropertyManager = async (propertyId: string, managerId: string | null) => {
    setUpdatingPropertyId(propertyId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/manager`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update")
      }
      setAssignSelection((prev) => ({ ...prev, [propertyId]: "" }))
      await fetchData()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("admin-filter-refresh"))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setUpdatingPropertyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Property managers" basePath={BASE} />
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading property managers...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Property managers"
        breadcrumbs={[{ label: "Property managers" }]}
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

        {filteredUnassigned.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Unassigned properties
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Assign a property manager below. Changes are saved to the database.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {filteredUnassigned.map((p) => (
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
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name || m.email}
                            {m.company_name ? ` (${m.company_name})` : ""}
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
                        setPropertyManager(p.id, assignSelection[p.id] || null)
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
            <UserCog className="h-5 w-5" />
            Managers and their properties
          </h2>
          {filteredManagers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  {filterManagerId || filterPropertyId
                    ? "No property managers match the current filter."
                    : "No property managers found."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredManagers.map((manager) => (
                <Card key={manager.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {manager.name || manager.email}
                      {manager.company_name && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({manager.company_name})
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {manager.email}
                      </span>
                      {manager.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {manager.phone}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                    <CardContent>
                    {(() => {
                      const propsToShow = filterPropertyId
                        ? manager.properties.filter((p) => p.id === filterPropertyId)
                        : manager.properties
                      return (
                        <>
                          <p className="text-sm font-medium text-foreground mb-2">
                            Properties ({propsToShow.length})
                          </p>
                          {propsToShow.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {filterPropertyId ? "This property is not assigned to this manager." : "No properties assigned."}
                            </p>
                          ) : (
                            <ul className="space-y-4 text-sm">
                              {propsToShow.map((p) => {
                          const units = p.units ?? []
                          const totalUnits = units.length
                          const totalTenants = units.reduce(
                            (sum, u) => sum + (u.tenants?.length ?? 0),
                            0
                          )
                          const activeTenants = units.reduce(
                            (sum, u) =>
                              sum +
                              (u.tenants?.filter((t) => !t.move_out_date).length ?? 0),
                            0
                          )
                          return (
                            <li
                              key={p.id}
                              className="border border-border rounded-lg p-3 space-y-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-foreground font-medium min-w-0 flex-1">
                                  {formatAddress(p)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {totalUnits} unit{totalUnits !== 1 ? "s" : ""}, {activeTenants} active tenant{activeTenants !== 1 ? "s" : ""}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value=""
                                    onValueChange={(newManagerId) =>
                                      setPropertyManager(p.id, newManagerId)
                                    }
                                  >
                                    <SelectTrigger className="w-[180px]" size="sm">
                                      <SelectValue placeholder="Reassign to…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {managers
                                        .filter((m) => m.id !== manager.id)
                                        .map((m) => (
                                          <SelectItem key={m.id} value={m.id}>
                                            {m.name || m.email}
                                          </SelectItem>
                                        ))}
                                      {managers.filter((m) => m.id !== manager.id).length === 0 && (
                                        <SelectItem value="_none" disabled>
                                          No other managers
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-destructive"
                                    disabled={updatingPropertyId === p.id}
                                    onClick={() => setPropertyManager(p.id, null)}
                                  >
                                    {updatingPropertyId === p.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Unassign"
                                    )}
                                  </Button>
                                </div>
                              </div>
                              {/* Units and tenants */}
                              {units.length > 0 && (
                                <ul className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                                  {units.map((unit) => (
                                    <li key={unit.id} className="space-y-1">
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <DoorOpen className="h-3.5 w-3.5 shrink-0" />
                                        <span className="font-medium text-foreground">
                                          Unit {unit.unit_number}
                                        </span>
                                        {(unit.tenants?.length ?? 0) > 0 && (
                                          <span className="text-xs">
                                            ({unit.tenants!.filter((t) => !t.move_out_date).length} active)
                                          </span>
                                        )}
                                      </div>
                                      {unit.tenants && unit.tenants.length > 0 ? (
                                        <ul className="ml-5 space-y-1">
                                          {unit.tenants.map((t) => (
                                            <li
                                              key={t.id}
                                              className="flex flex-wrap items-center gap-2 text-xs"
                                            >
                                              <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                                              <span className="text-foreground">{t.name}</span>
                                              {t.email && (
                                                <span className="text-muted-foreground truncate max-w-[180px]">
                                                  {t.email}
                                                </span>
                                              )}
                                              <span
                                                className={
                                                  t.move_out_date
                                                    ? "text-muted-foreground italic"
                                                    : "text-green-600 dark:text-green-400"
                                                }
                                              >
                                                {t.move_out_date ? "Moved out" : "Active"}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="ml-5 text-xs text-muted-foreground italic">
                                          No tenants
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {units.length === 0 && (
                                <p className="ml-6 text-xs text-muted-foreground italic">
                                  No units
                                </p>
                              )}
                            </li>
                          )
                        })}
                            </ul>
                          )}
                        </>
                      )
                    })()}
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
