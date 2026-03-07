"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, ChevronLeft, DoorOpen, User, Pencil } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"
import { EditPropertyModal } from "@/components/admin"

const BASE = "/manager"

type Tenant = {
  id: string
  name: string
  email: string | null
  move_out_date: string | null
}

type Unit = {
  id: string
  unit_number: string
  tenants: Tenant[] | null
}

type PropertyDetail = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  units: Unit[] | null
}

export default function ManagerPropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params?.propertyId as string
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [fullProperty, setFullProperty] = useState<any>(null)

  useEffect(() => {
    if (!propertyId) return
    load()
  }, [propertyId])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data, error: e } = await supabase
        .from("properties")
        .select(
          `
          *,
          units (
            id,
            unit_number,
            tenants (
              id,
              name,
              email,
              move_out_date
            )
          )
        `
        )
        .eq("id", propertyId)
        .single()
      if (e) throw e
      setProperty(data as PropertyDetail)
      setFullProperty(data)
    } catch (err) {
      setError("Property not found or you don't have access.")
      setProperty(null)
      setFullProperty(null)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (p: PropertyDetail) => {
    const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
    return parts.length ? parts.join(", ") : "Property"
  }

  const activeTenants = (unit: Unit) =>
    (unit.tenants || []).filter((t) => !t.move_out_date)

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title={property ? formatAddress(property) : "Property"}
        breadcrumbs={[
          { label: "Properties", href: `${BASE}/properties` },
          { label: property ? formatAddress(property) : "…" },
        ]}
        basePath={BASE}
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            className="-ml-2"
            onClick={() => router.push(`${BASE}/properties`)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to properties
          </Button>
          {property && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFullProperty(property)
                setIsEditOpen(true)
              }}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error || !property ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">{error ?? "Property not found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {formatAddress(property)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Units and tenants. Click a tenant name to view details.
              </p>
            </CardHeader>
            <CardContent>
              {!property.units?.length ? (
                <p className="text-muted-foreground">No units.</p>
              ) : (
                <ul className="space-y-4">
                  {property.units.map((unit) => {
                    const tenants = activeTenants(unit)
                    return (
                      <li
                        key={unit.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-b border-border last:border-0"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <DoorOpen className="h-4 w-4 text-muted-foreground" />
                          Unit {unit.unit_number}
                        </span>
                        {tenants.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No current tenant</span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-2">
                            {tenants.map((t) => (
                              <Link
                                key={t.id}
                                href={`${BASE}/customers/${t.id}`}
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <User className="h-4 w-4" />
                                {t.name}
                              </Link>
                            ))}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {fullProperty && (
          <EditPropertyModal
            isOpen={isEditOpen}
            onClose={() => {
              setIsEditOpen(false)
              setFullProperty(null)
            }}
            onSuccess={() => {
              load()
              setIsEditOpen(false)
              setFullProperty(null)
            }}
            property={fullProperty}
          />
        )}
      </main>
    </div>
  )
}
