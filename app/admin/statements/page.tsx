"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getStatements } from "@/lib/data"
import { createSupabaseClient } from "@/lib/supabase/client"
import type { Statement } from "@/lib/types"

const BASE = "/admin"

const columns = [
  { key: "id", header: "ID" },
  { key: "accountNumber", header: "Account Number" },
  { key: "residentName", header: "Resident Name" },
  { key: "unit", header: "Unit" },
  { key: "streetAddress", header: "Street Address" },
  { key: "city", header: "City" },
  { key: "startDate", header: "Start Date" },
  { key: "endDate", header: "End Date" },
  { key: "amountDue", header: "Amount Due" },
  { key: "changeLastMonth", header: "Change Last Month" },
  { key: "amountPaid", header: "Amount Paid" },
  { key: "dueDate", header: "Due Date" },
  { key: "landlordName", header: "Landlord Name" },
  {
    key: "pdf",
    header: "PDF File",
    render: () => (
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
        <FileText className="h-4 w-4" />
      </Button>
    ),
  },
  {
    key: "action",
    header: "Action",
    render: (item: Statement) => (
      <Badge
        variant={
          item.status === "paid"
            ? "default"
            : item.status === "pending"
              ? "secondary"
              : "destructive"
        }
        className={
          item.status === "paid" ? "bg-green-500 hover:bg-green-600 text-white" : ""
        }
      >
        {item.status === "paid"
          ? "Paid"
          : item.status === "pending"
            ? "Pay"
            : "Overdue"}
      </Badge>
    ),
  },
]

export default function AdminStatementsPage() {
  const searchParams = useSearchParams()
  const managerId = searchParams.get("manager") || undefined
  const propertyId = searchParams.get("property") || undefined

  const [data, setData] = useState<Statement[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; manager_id: string | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatements()
  }, [])

  const loadStatements = async () => {
    try {
      setLoading(true)
      const [statementsData, propsRes] = await Promise.all([
        getStatements(),
        createSupabaseClient().from("properties").select("id, manager_id"),
      ])
      setData(statementsData)
      setProperties(propsRes.data || [])
    } catch (error) {
      console.error("Error loading statements:", error)
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
    return data.filter((s) => s.propertyId && filteredPropertyIds.has(s.propertyId))
  }, [data, filteredPropertyIds, managerId, propertyId])

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Statements"
        breadcrumbs={[{ label: "Statements" }]}
        basePath={BASE}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Month
                </label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue placeholder="Select Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                    <SelectItem value="february">February</SelectItem>
                    <SelectItem value="march">March</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Year
                </label>
                <Select defaultValue="2025">
                  <SelectTrigger>
                    <SelectValue placeholder="Select Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex items-end">
                <Button className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export Statements
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Tenant Statements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable data={filteredData} columns={columns} showPrint={true} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
