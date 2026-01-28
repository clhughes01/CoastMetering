"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Plus, Users } from "lucide-react"
import { getCustomers } from "@/lib/data"
import type { Customer } from "@/lib/types"
import { CreatePropertyModal, CreateUnitModal, CreateTenantModal, CreateMeterModal, EditTenantModal } from "@/components/admin"

// Column definitions - these stay the same regardless of data source
const columns = [
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
]

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false)
  const [isCreateTenantModalOpen, setIsCreateTenantModalOpen] = useState(false)
  const [isCreateMeterModalOpen, setIsCreateMeterModalOpen] = useState(false)
  const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<{ id: string; number: string } | null>(null)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const customers = await getCustomers()
      setData(customers)
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Dashboard" 
        breadcrumbs={[
          { label: "Create Customer", href: "#" },
          { label: "Manage Customer" }
        ]} 
      />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Actions Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Months" />
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

        {/* Customers Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Manage Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={data}
              columns={columns}
              showPrint={true}
            />
          </CardContent>
        </Card>

        {/* Modals */}
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
      </main>
    </div>
  )
}
