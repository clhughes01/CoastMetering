"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, User, Mail, Phone, DoorOpen, Building2, Calendar } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"

const BASE = "/manager"

type TenantDetail = {
  id: string
  name: string
  email: string | null
  phone: string | null
  move_in_date: string
  move_out_date: string | null
  account_number: string | null
  unit_id: string
  units: {
    id: string
    unit_number: string
    property_id: string
    properties: {
      id: string
      address: string | null
      city: string | null
      state: string | null
      zip_code: string | null
    } | null
  } | null
}

export default function ManagerCustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params?.tenantId as string
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tenantId) return
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const supabase = createSupabaseClient()
        const { data, error: e } = await supabase
          .from("tenants")
          .select(
            `
            id,
            name,
            email,
            phone,
            move_in_date,
            move_out_date,
            account_number,
            unit_id,
            units (
              id,
              unit_number,
              property_id,
              properties (
                id,
                address,
                city,
                state,
                zip_code
              )
            )
          `
          )
          .eq("id", tenantId)
          .single()
        if (e) throw e
        if (!data) throw new Error("No data")
        const raw = data as Record<string, unknown>
        const unitsRaw = raw.units
        const u = Array.isArray(unitsRaw) ? unitsRaw[0] : unitsRaw
        const uObj = u as Record<string, unknown> | null | undefined
        const propRaw = uObj?.properties
        const prop = Array.isArray(propRaw) ? propRaw[0] : propRaw
        const pObj = prop as Record<string, unknown> | null | undefined
        const normalized: TenantDetail = {
          id: raw.id as string,
          name: raw.name as string,
          email: (raw.email as string | null) ?? null,
          phone: (raw.phone as string | null) ?? null,
          move_in_date: raw.move_in_date as string,
          move_out_date: (raw.move_out_date as string | null) ?? null,
          account_number: (raw.account_number as string | null) ?? null,
          unit_id: raw.unit_id as string,
          units: uObj
            ? {
                id: uObj.id as string,
                unit_number: uObj.unit_number as string,
                property_id: uObj.property_id as string,
                properties: pObj
                  ? {
                      id: pObj.id as string,
                      address: (pObj.address as string | null) ?? null,
                      city: (pObj.city as string | null) ?? null,
                      state: (pObj.state as string | null) ?? null,
                      zip_code: (pObj.zip_code as string | null) ?? null,
                    }
                  : null,
              }
            : null,
        }
        setTenant(normalized)
      } catch (err) {
        setError("Tenant not found or you don't have access.")
        setTenant(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId])

  const formatAddress = (p: { address?: string | null; city?: string | null; state?: string | null; zip_code?: string | null }) => {
    if (!p) return "—"
    const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
  }

  const propertyAddress = tenant?.units?.properties
    ? formatAddress(tenant.units.properties)
    : "—"
  const propertyId = tenant?.units?.properties?.id

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title={tenant ? tenant.name : "Tenant"}
        breadcrumbs={[
          { label: "Tenants", href: `${BASE}/customers` },
          { label: tenant ? tenant.name : "…" },
        ]}
        basePath={BASE}
      />
      <main className="flex-1 p-4 md:p-6">
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => router.push(`${BASE}/customers`)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to tenants
        </Button>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error || !tenant ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">{error ?? "Tenant not found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Tenant information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{tenant.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{tenant.email ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{tenant.phone ?? "—"}</p>
                  </div>
                </div>
                {tenant.account_number && (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">#</span>
                    <div>
                      <p className="text-sm text-muted-foreground">Account number</p>
                      <p className="font-medium">{tenant.account_number}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Move-in date</p>
                    <p className="font-medium">
                      {tenant.move_in_date
                        ? new Date(tenant.move_in_date).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                {tenant.move_out_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Move-out date</p>
                      <p className="font-medium">
                        {new Date(tenant.move_out_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-6">
                <p className="text-sm font-medium text-muted-foreground mb-3">Location</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-muted-foreground" />
                    <span>Unit {tenant.units?.unit_number ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {propertyId ? (
                      <Link
                        href={`${BASE}/properties/${propertyId}`}
                        className="text-primary hover:underline"
                      >
                        {propertyAddress}
                      </Link>
                    ) : (
                      <span>{propertyAddress}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
