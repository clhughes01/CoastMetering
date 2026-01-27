"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Receipt, FileSpreadsheet, FileText, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { getUtilityBills } from "@/lib/data"
import type { UtilityBill } from "@/lib/types"

export default function UtilityBillsPage() {
  const [data, setData] = useState<UtilityBill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<number[]>([])

  useEffect(() => {
    loadUtilityBills()
  }, [])

  const loadUtilityBills = async () => {
    try {
      setLoading(true)
      const billsData = await getUtilityBills()
      setData(billsData)
    } catch (error) {
      console.error('Error loading utility bills:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: number) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedRows(prev => 
      prev.length === data.length ? [] : data.map(b => b.id)
    )
  }

  const columns = [
    { 
      key: "select", 
      header: "",
      render: (item: UtilityBill) => (
        <Checkbox 
          checked={selectedRows.includes(item.id)}
          onCheckedChange={() => toggleRow(item.id)}
        />
      )
    },
    { key: "id", header: "ID" },
    { key: "month", header: "Month" },
    { key: "year", header: "Year" },
    { key: "billDate", header: "Bill Date" },
    { key: "totalAmount", header: "Total Amount" },
    { key: "numberOfUnits", header: "Number of Units" },
    { key: "landlord", header: "Landlord" },
    { 
      key: "masterSheet", 
      header: "Master Sheet",
      render: () => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-orange-500 hover:text-orange-600">
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ]

  // Calculate summary stats from data
  const totalBilled = data.reduce((sum, bill) => {
    const amount = Number.parseFloat(bill.totalAmount.replace(/[$,]/g, '')) || 0
    return sum + amount
  }, 0)
  const totalUnits = data.reduce((sum, bill) => sum + (bill.numberOfUnits || 0), 0)
  const avgMonthly = data.length > 0 ? totalBilled / data.length : 0
  const avgUnits = data.length > 0 ? Math.round(totalUnits / data.length) : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Dashboard" 
        breadcrumbs={[{ label: "Utility Statements" }]} 
      />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Utility Bills Table */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" />
                Monthly Utility Bills Master Sheet
                {selectedRows.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-2">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Check Marks
                  </Button>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedRows.length === data.length && data.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            </div>
            <DataTable
              data={data}
              columns={columns}
              showPrint={true}
            />
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Billing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-foreground">${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">Total Billed (YTD)</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{totalUnits}</p>
                <p className="text-sm text-muted-foreground">Total Units Billed</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-foreground">${avgMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">Avg. Monthly Bill</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{avgUnits}</p>
                <p className="text-sm text-muted-foreground">Avg. Units/Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
