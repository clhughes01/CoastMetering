"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"
import { LandlordViewFilter } from "@/components/landlord/landlord-view-filter"

const BASE = "/landlord"

type Property = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  units_count?: number
  tenants_count?: number
}

export default function LandlordPropertiesPage() {
  const searchParams = useSearchParams()
  const propertyId = searchParams.get("property") || undefined
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createSupabaseClient()
        const { data, error } = await supabase
          .from("properties")
          .select(`
            id,
            address,
            city,
            state,
            zip_code,
            units (
              id,
              tenants ( id, move_out_date )
            )
          `)
          .order("address", { ascending: true })
        if (error) throw error
        const list = (data || []).map((p: any) => ({
          id: p.id,
          address: p.address,
          city: p.city,
          state: p.state,
          zip_code: p.zip_code,
          units_count: p.units?.length ?? 0,
          tenants_count: p.units?.reduce(
            (s: number, u: any) => s + (u.tenants?.filter((t: any) => !t.move_out_date).length ?? 0),
            0
          ) ?? 0,
        }))
        setProperties(list)
      } catch {
        setProperties([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = propertyId
    ? properties.filter((p) => p.id === propertyId)
    : properties

  const formatAddress = (p: Property) => {
    const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
    return parts.length ? parts.join(", ") : p.id
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Properties" breadcrumbs={[{ label: "Properties" }]} basePath={BASE} />
      <LandlordViewFilter />
      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Your properties (read-only)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Properties assigned to you by your Property Manager or admin. Tenants come with the property.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">
                {propertyId ? "No property matches the filter." : "No properties assigned to you yet."}
              </p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-4 py-3 border-b border-border last:border-0"
                  >
                    <span className="font-medium">{formatAddress(p)}</span>
                    <span className="text-sm text-muted-foreground">
                      {p.units_count ?? 0} unit(s) · {p.tenants_count ?? 0} tenant(s)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
