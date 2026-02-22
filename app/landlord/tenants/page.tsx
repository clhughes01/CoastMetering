"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"
import { LandlordViewFilter } from "@/components/landlord/landlord-view-filter"

const BASE = "/landlord"

type TenantRow = {
  id: string
  name: string
  email: string | null
  unit_number: string
  property_address: string
  property_id: string
}

export default function LandlordTenantsPage() {
  const searchParams = useSearchParams()
  const propertyId = searchParams.get("property") || undefined
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createSupabaseClient()
        const { data: unitsData, error: unitsError } = await supabase
          .from("units")
          .select(`
            id,
            unit_number,
            property_id,
            properties ( id, address, city, state, zip_code ),
            tenants ( id, name, email, move_out_date )
          `)
        if (unitsError) throw unitsError
        const list: TenantRow[] = []
        for (const u of unitsData || []) {
          const prop = u.properties as any
          const address = prop ? [prop.address, [prop.city, prop.state, prop.zip_code].filter(Boolean).join(", ")].filter(Boolean).join(", ") : ""
          for (const t of (u.tenants || []) as any[]) {
            if (t.move_out_date) continue
            list.push({
              id: t.id,
              name: t.name,
              email: t.email,
              unit_number: u.unit_number,
              property_address: address,
              property_id: u.property_id,
            })
          }
        }
        setTenants(list)
      } catch {
        setTenants([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = propertyId
    ? tenants.filter((t) => t.property_id === propertyId)
    : tenants

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Tenants" breadcrumbs={[{ label: "Tenants" }]} basePath={BASE} />
      <LandlordViewFilter />
      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Tenants (read-only)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Tenants on your assigned properties.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">
                {propertyId ? "No tenants match the filter." : "No tenants on your properties."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Unit</th>
                      <th className="text-left py-2">Property</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="py-2">{t.name}</td>
                        <td className="py-2 text-muted-foreground">{t.email ?? "—"}</td>
                        <td className="py-2">{t.unit_number}</td>
                        <td className="py-2 text-muted-foreground">{t.property_address}</td>
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
