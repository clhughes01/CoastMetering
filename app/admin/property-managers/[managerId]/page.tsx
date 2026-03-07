"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, ChevronLeft, DoorOpen, Mail, Phone, UserCog, Users } from "lucide-react"

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

type ManagerDetail = {
  id: string
  email: string
  name: string | null
  company_name: string | null
  phone: string | null
  properties: PropertyRow[]
}

type ApiResponse = {
  success: boolean
  data: ManagerDetail[]
}

export default function AdminPropertyManagerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const managerId = params?.managerId as string
  const [manager, setManager] = useState<ManagerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!managerId) return
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/admin/property-managers")
        if (!res.ok) throw new Error("Failed to load")
        const json: ApiResponse = await res.json()
        const found = (json.data || []).find((m) => m.id === managerId)
        if (!found) throw new Error("Property manager not found")
        setManager(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Property manager not found.")
        setManager(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [managerId])

  const formatAddress = (p: PropertyRow) => {
    const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
  }

  const displayName = manager
    ? `${manager.name || manager.email}${manager.company_name ? ` (${manager.company_name})` : ""}`
    : "…"

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title={displayName}
        breadcrumbs={[
          { label: "Property Managers", href: `${BASE}/property-managers` },
          { label: displayName },
        ]}
        basePath={BASE}
      />
      <main className="flex-1 p-4 md:p-6">
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => router.push(`${BASE}/property-managers`)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to property managers
        </Button>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error || !manager ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">{error ?? "Property manager not found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
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
              <p className="text-sm font-medium text-foreground mb-2">
                Properties ({manager.properties.length})
              </p>
              {manager.properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties assigned.</p>
              ) : (
                <ul className="space-y-4 text-sm">
                  {manager.properties.map((p) => {
                    const units = p.units ?? []
                    const activeTenants = units.reduce(
                      (sum, u) =>
                        sum + (u.tenants?.filter((t) => !t.move_out_date).length ?? 0),
                      0
                    )
                    return (
                      <li
                        key={p.id}
                        className="border border-border rounded-lg p-3 space-y-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <Link
                            href={`${BASE}/properties/${p.id}`}
                            className="text-primary hover:underline font-medium min-w-0 flex-1"
                          >
                            {formatAddress(p)}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {units.length} unit{units.length !== 1 ? "s" : ""}, {activeTenants} active tenant{activeTenants !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {units.length > 0 && (
                          <ul className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                            {units.map((unit) => (
                              <li key={unit.id} className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <DoorOpen className="h-3.5 w-3.5 shrink-0" />
                                  <span className="font-medium text-foreground">
                                    Unit {unit.unit_number}
                                  </span>
                                </div>
                                {unit.tenants && unit.tenants.length > 0 ? (
                                  <ul className="ml-5 space-y-1">
                                    {unit.tenants.map((t) => (
                                      <li key={t.id} className="flex items-center gap-2 text-xs">
                                        <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        <Link
                                          href={`${BASE}/customers/${t.id}`}
                                          className="text-primary hover:underline"
                                        >
                                          {t.name}
                                        </Link>
                                        {t.move_out_date && (
                                          <span className="text-muted-foreground italic">Moved out</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="ml-5 text-xs text-muted-foreground italic">No tenants</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
