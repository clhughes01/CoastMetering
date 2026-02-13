"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { DataTable } from "@/components/manager/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, ExternalLink, DollarSign, TrendingUp, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getPayments } from "@/lib/data"
import type { Payment } from "@/lib/types"

const getStatusBadge = (status: Payment["status"]) => {
  switch (status) {
    case "succeeded":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white">Succeeded</Badge>
    case "PENDING":
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>
    case "requires_payment_method":
      return <Badge variant="outline" className="text-orange-600 border-orange-300">Requires Payment</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const columns = [
  { key: "id", header: "ID" },
  { key: "accountNumber", header: "Account Number" },
  { key: "residentName", header: "Resident Name" },
  { key: "dateBilled", header: "Date Billed" },
  { key: "totalAmount", header: "Total Amount" },
  { key: "landlordName", header: "Landlord Name" },
  { 
    key: "status", 
    header: "Status",
    render: (item: Payment) => getStatusBadge(item.status)
  },
  { 
    key: "action", 
    header: "Action",
    render: () => (
      <Button variant="ghost" size="sm">
        <ExternalLink className="h-4 w-4" />
      </Button>
    )
  },
]

// Stats are computed from payment data in the component

export default function PaymentsPage() {
  const [data, setData] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const paymentsData = await getPayments()
      setData(paymentsData)
    } catch (error) {
      console.error("Error loading payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const parseAmount = (totalAmount: Payment["totalAmount"]) =>
    Number.parseFloat(String(totalAmount).replace(/[$,]/g, "") || "0")

  const totalCollected = data
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + parseAmount(p.totalAmount), 0)
  const pendingPayments = data.filter((p) => p.status === "PENDING")
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + parseAmount(p.totalAmount), 0)
  const successRate = data.length > 0
    ? Math.round((data.filter((p) => p.status === "succeeded").length / data.length) * 100)
    : 0

  const stats = [
    { label: "Total Collected", value: `$${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, change: data.filter((p) => p.status === "succeeded").length + " payments" },
    { label: "Pending Payments", value: `$${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Clock, change: pendingPayments.length + " payments" },
    { label: "Success Rate", value: successRate + "%", icon: TrendingUp, change: "Of all transactions" },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Payments" 
        breadcrumbs={[{ label: "Payments" }]} 
      />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.change}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Data */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="history" className="w-full">
              <div className="px-4 pt-4">
                <TabsList>
                  <TabsTrigger value="history">Payment History</TabsTrigger>
                  <TabsTrigger value="payout">Payout Method</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="history" className="mt-0">
                <DataTable
                  data={data}
                  columns={columns}
                  title="Payment History"
                  showPrint={true}
                />
              </TabsContent>
              
              <TabsContent value="payout" className="p-4">
                <div className="bg-muted/30 rounded-lg p-6 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Payout Method</h3>
                  <p className="text-muted-foreground mb-4">Configure your payout method to receive payments from tenants. Connect with Stripe or Plaid for secure transactions.</p>
                  <Button>
                    Connect Bank Account
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
