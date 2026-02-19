"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, Home, Pencil } from "lucide-react"
import { CreatePropertyModal, EditPropertyModal } from "@/components/admin"
import { createSupabaseClient } from "@/lib/supabase/client"

const BASE = "/admin"

interface Property {
  id: string
  address: string
  city: string
  state: string
  zip_code: string
  owner_name: string | null
  units_count?: number
  tenants_count?: number
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreatePropertyModalOpen, setIsCreatePropertyModalOpen] = useState(false)
  const [isEditPropertyModalOpen, setIsEditPropertyModalOpen] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<any>(null)

  useEffect(() => {
    loadProperties()
  }, [])

  const loadProperties = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseClient()

      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          *,
          units (
            id,
            unit_number,
            tenants (
              id,
              move_out_date
            )
          )
        `
        )
        .order("created_at", { ascending: false })

      if (error) throw error

      const formattedData = (data || []).map((property: any) => ({
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state,
        zip_code: property.zip_code,
        owner_name: property.owner_name,
        water_utility: property.water_utility,
        power_utility: property.power_utility,
        gas_utility: property.gas_utility,
        units_count: property.units?.length || 0,
        tenants_count:
          property.units?.reduce((acc: number, unit: any) => {
            const activeTenants = unit.tenants?.filter((t: any) => !t.move_out_date).length || 0
            return acc + activeTenants
          }, 0) || 0,
        _fullData: property,
      }))

      setProperties(formattedData)
    } catch (error) {
      console.error("Error loading properties:", error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: "address", header: "Address" },
    { key: "city", header: "City" },
    { key: "state", header: "State" },
    { key: "zip_code", header: "ZIP Code" },
    { key: "owner_name", header: "Owner" },
    { key: "units_count", header: "Units" },
    { key: "tenants_count", header: "Active Tenants" },
  ]

  const formattedData = properties.map((property) => ({
    ...property,
    address: property.address,
    city: `${property.city}, ${property.state}`,
    state: property.state,
    zip_code: property.zip_code,
    owner_name: property.owner_name || "N/A",
    units_count: property.units_count || 0,
    tenants_count: property.tenants_count || 0,
  }))

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Properties" breadcrumbs={[{ label: "Properties" }]} basePath={BASE} />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">All Properties</h2>
              </div>
              <Button onClick={() => setIsCreatePropertyModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="h-5 w-5 text-primary" />
              Properties Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading properties...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 text-left text-sm font-medium text-foreground"
                        >
                          {col.header}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formattedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length + 1}
                          className="px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          No properties yet. Add your first property to see data here.
                        </td>
                      </tr>
                    ) : (
                      formattedData.map((property) => (
                        <tr
                          key={property.id}
                          className="border-b border-border hover:bg-muted/30"
                        >
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className="px-4 py-3 text-sm text-foreground"
                            >
                              {property[col.key as keyof typeof property] || "N/A"}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const supabase = createSupabaseClient()
                                  const { data: fullProperty, error } = await supabase
                                    .from("properties")
                                    .select("*")
                                    .eq("id", property.id)
                                    .single()
                                  if (!error && fullProperty) {
                                    setSelectedProperty(fullProperty)
                                    setIsEditPropertyModalOpen(true)
                                  }
                                } catch (err) {
                                  console.error("Error loading property:", err)
                                }
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreatePropertyModal
          isOpen={isCreatePropertyModalOpen}
          onClose={() => setIsCreatePropertyModalOpen(false)}
          onSuccess={() => {
            loadProperties()
            setIsCreatePropertyModalOpen(false)
          }}
        />
        <EditPropertyModal
          isOpen={isEditPropertyModalOpen}
          onClose={() => {
            setIsEditPropertyModalOpen(false)
            setSelectedProperty(null)
          }}
          onSuccess={() => {
            loadProperties()
            setIsEditPropertyModalOpen(false)
            setSelectedProperty(null)
          }}
          property={selectedProperty}
        />
      </main>
    </div>
  )
}
