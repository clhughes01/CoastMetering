"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Plus, Users, UserRoundCog } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"
import type { Customer } from "@/lib/types"
import {
  CreateUnitModal,
  CreateTenantModal,
  CreateMeterModal,
  EditTenantModal,
  ChangeTenantModal,
} from "@/components/admin"

const BASE = "/admin"

function getColumns(onChangeTenant: (customer: Customer) => void) {
  return [
    { key: "id", header: "ID" },
    { key: "accountNumber", header: "Account Number" },
    { key: "residentName", header: "Resident Name" },
    { key: "unit", header: "Unit" },
    { key: "streetAddress", header: "Street Address" },
    { key: "city", header: "City" },
    { key: "zipCode", header: "Zip Code" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "landlordName", header: "Landlord Name" },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (item: Customer) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChangeTenant(item)}
          disabled={!item.unitId}
          title={
            item.unitId
              ? "Replace with a new tenant for this unit"
              : "Unit not linked"
          }
        >
          <UserRoundCog className="h-4 w-4 mr-1" />
          Change tenant
        </Button>
      ),
    },
  ]
}

export default function AdminCustomersPage() {
  const searchParams = useSearchParams()
  const managerId = searchParams.get("manager") || undefined
  const propertyId = searchParams.get("property") || undefined

  const [data, setData] = useState<Customer[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; manager_id: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false)
  const [isCreateTenantModalOpen, setIsCreateTenantModalOpen] = useState(false)
  const [isCreateMeterModalOpen, setIsCreateMeterModalOpen] = useState(false)
  const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false)
  const [isChangeTenantModalOpen, setIsChangeTenantModalOpen] = useState(false)
  const [customerForChange, setCustomerForChange] = useState<Customer | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<{ id: string; number: string } | null>(null)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)

  const openChangeTenant = (customer: Customer) => {
    setCustomerForChange(customer)
    setIsChangeTenantModalOpen(true)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const [tenantsRes, propsRes] = await Promise.all([
        fetch("/api/tenants/list"),
        createSupabaseClient().from("properties").select("id, manager_id"),
      ])
      const tenantsJson = tenantsRes.ok ? await tenantsRes.json() : { data: [] }
      setData(tenantsJson.data ?? [])
      setProperties(propsRes.data || [])
    } catch (error) {
      console.error("Error loading customers:", error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const filteredPropertyIds = useMemo(() => {
    let ids = new Set(properties.map((p) => p.id))
    if (managerId) ids = new Set(properties.filter((p) => p.manager_id === managerId).map((p) => p.id))
    if (propertyId) ids = ids.has(propertyId) ? new Set([propertyId]) : new Set()
    return ids
  }, [properties, managerId, propertyId])

  const filteredData = useMemo(() => {
    if (!managerId && !propertyId) return data
    if (filteredPropertyIds.size === 0) return []
    return data.filter((c) => c.propertyId && filteredPropertyIds.has(c.propertyId))
  }, [data, filteredPropertyIds, managerId, propertyId])

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Tenants"
        breadcrumbs={[{ label: "Tenants" }]}
        basePath={BASE}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                    <SelectItem value="february">February</SelectItem>
                    <SelectItem value="march">March</SelectItem>
                    <SelectItem value="april">April</SelectItem>
                    <SelectItem value="may">May</SelectItem>
                    <SelectItem value="june">June</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setIsCreateTenantModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tenant
                </Button>
                <Button className="bg-primary hover:bg-primary/90">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Manage Tenants
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={filteredData}
              columns={getColumns(openChangeTenant)}
              showPrint={true}
            />
          </CardContent>
        </Card>

        {selectedPropertyId && (
          <CreateUnitModal
            isOpen={isCreateUnitModalOpen}
            onClose={() => {
              setIsCreateUnitModalOpen(false)
              setSelectedPropertyId(null)
            }}
            onSuccess={() => {
              loadCustomers()
              setIsCreateUnitModalOpen(false)
              setSelectedPropertyId(null)
            }}
            propertyId={selectedPropertyId}
          />
        )}
        <CreateTenantModal
          isOpen={isCreateTenantModalOpen}
          onClose={() => {
            setIsCreateTenantModalOpen(false)
            setSelectedUnit(null)
          }}
          onSuccess={() => {
            loadCustomers()
            setIsCreateTenantModalOpen(false)
            setSelectedUnit(null)
          }}
          unitId={selectedUnit?.id}
          unitNumber={selectedUnit?.number}
        />
        {selectedUnit && (
          <CreateMeterModal
            isOpen={isCreateMeterModalOpen}
            onClose={() => {
              setIsCreateMeterModalOpen(false)
              setSelectedUnit(null)
            }}
            onSuccess={() => {
              loadCustomers()
              setIsCreateMeterModalOpen(false)
              setSelectedUnit(null)
            }}
            unitId={selectedUnit.id}
            unitNumber={selectedUnit.number}
          />
        )}
        <EditTenantModal
          isOpen={isEditTenantModalOpen}
          onClose={() => {
            setIsEditTenantModalOpen(false)
            setSelectedTenant(null)
          }}
          onSuccess={() => {
            loadCustomers()
            setIsEditTenantModalOpen(false)
            setSelectedTenant(null)
          }}
          tenant={selectedTenant}
        />
        {customerForChange?.unitId && (
          <ChangeTenantModal
            isOpen={isChangeTenantModalOpen}
            onClose={() => {
              setIsChangeTenantModalOpen(false)
              setCustomerForChange(null)
            }}
            onSuccess={() => {
              loadCustomers()
              setIsChangeTenantModalOpen(false)
              setCustomerForChange(null)
            }}
            unitId={customerForChange.unitId}
            unitNumber={customerForChange.unit}
            currentTenantId={customerForChange.tenantId ?? null}
            currentTenantName={customerForChange.residentName ?? null}
          />
        )}
      </main>
    </div>
  )
}
