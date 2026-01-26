"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getStatements } from "@/lib/data"
import type { Statement } from "@/lib/types"

// Column definitions - these stay the same regardless of data source
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
    )
  },
  { 
    key: "action", 
    header: "Action",
    render: (item: Statement) => (
      <Badge 
        variant={item.status === "paid" ? "default" : item.status === "pending" ? "secondary" : "destructive"}
        className={item.status === "paid" ? "bg-green-500 hover:bg-green-600 text-white" : ""}
      >
        {item.status === "paid" ? "Paid" : item.status === "pending" ? "Pay" : "Overdue"}
      </Badge>
    )
  },
]

export default function StatementsPage() {
  const [data, setData] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatements()
  }, [])

  const loadStatements = async () => {
    try {
      setLoading(true)
      const statementsData = await getStatements()
      setData(statementsData)
    } catch (error) {
      console.error('Error loading statements:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Dashboard" 
        breadcrumbs={[{ label: "Customer Statements" }]} 
      />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Months :</label>
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
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Years :</label>
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

        {/* Statements Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Customer Statements
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
      </main>
    </div>
  )
}
