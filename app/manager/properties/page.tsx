"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, Users, Home, Pencil } from "lucide-react"
import { CreatePropertyModal, CreateUnitModal, CreateTenantModal, EditPropertyModal } from "@/components/admin"
import { createSupabaseClient } from "@/lib/supabase/client"
import Link from "next/link"

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

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreatePropertyModalOpen, setIsCreatePropertyModalOpen] = useState(false)
  const [isEditPropertyModalOpen, setIsEditPropertyModalOpen] = useState(false)
  const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false)
  const [isCreateTenantModalOpen, setIsCreateTenantModalOpen] = useState(false)
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
        .from('properties')
        .select(`
          *,
          units (
            id,
            unit_number,
            tenants (
              id,
              move_out_date
            )
          )
        `)
        .order('created_at', { ascending: false })

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
        tenants_count: property.units?.reduce((acc: number, unit: any) => {
          const activeTenants = unit.tenants?.filter((t: any) => !t.move_out_date).length || 0
          return acc + activeTenants
        }, 0) || 0,
        // Store full property data for editing
        _fullData: property,
      }))

      setProperties(formattedData)
    } catch (error) {
      console.error('Error loading properties:', error)
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
    owner_name: property.owner_name || 'N/A',
    units_count: property.units_count || 0,
    tenants_count: property.tenants_count || 0,
  }))

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Properties" 
        breadcrumbs={[{ label: "Properties" }]} 
      />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Actions Bar */}
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

        {/* Properties Table */}
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
            ) : properties.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No properties found. Create your first property to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      {columns.map((col) => (
                        <th key={col.key} className="px-4 py-3 text-left text-sm font-medium text-foreground">
                          {col.header}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formattedData.map((property) => (
                      <tr key={property.id} className="border-b border-border hover:bg-muted/30">
                        {columns.map((col) => (
                          <td key={col.key} className="px-4 py-3 text-sm text-foreground">
                            {property[col.key as keyof typeof property] || 'N/A'}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              // Fetch full property data with all fields
                              try {
                                const supabase = createSupabaseClient()
                                const { data: fullProperty, error } = await supabase
                                  .from('properties')
                                  .select('*')
                                  .eq('id', property.id)
                                  .single()
                                
                                if (!error && fullProperty) {
                                  setSelectedProperty(fullProperty)
                                  setIsEditPropertyModalOpen(true)
                                }
                              } catch (err) {
                                console.error('Error loading property:', err)
                              }
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modals */}
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
        {selectedPropertyId && (
          <>
            <CreateUnitModal
              isOpen={isCreateUnitModalOpen}
              onClose={() => {
                setIsCreateUnitModalOpen(false)
                setSelectedPropertyId(null)
              }}
              onSuccess={() => {
                loadProperties()
                setIsCreateUnitModalOpen(false)
                setSelectedPropertyId(null)
              }}
              propertyId={selectedPropertyId}
            />
            <CreateTenantModal
              isOpen={isCreateTenantModalOpen}
              onClose={() => {
                setIsCreateTenantModalOpen(false)
                setSelectedPropertyId(null)
              }}
              onSuccess={() => {
                loadProperties()
                setIsCreateTenantModalOpen(false)
                setSelectedPropertyId(null)
              }}
            />
          </>
        )}
      </main>
    </div>
  )
}
