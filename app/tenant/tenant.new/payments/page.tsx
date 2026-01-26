"use client"

import { TenantHeader } from "@/components/tenant/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, Plus, CheckCircle, Clock, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Payment {
  id: number
  date: string
  amount: string
  method: string
  status: "completed" | "pending" | "failed"
  confirmationNumber: string
}

const payments: Payment[] = [
  { id: 1, date: "01-15-2025", amount: "$87.50", method: "Visa ****4242", status: "completed", confirmationNumber: "PAY-2025-0115" },
  { id: 2, date: "12-12-2024", amount: "$78.22", method: "Visa ****4242", status: "completed", confirmationNumber: "PAY-2024-1212" },
  { id: 3, date: "11-08-2024", amount: "$94.10", method: "Visa ****4242", status: "completed", confirmationNumber: "PAY-2024-1108" },
  { id: 4, date: "10-10-2024", amount: "$101.54", method: "Bank Transfer", status: "completed", confirmationNumber: "PAY-2024-1010" },
  { id: 5, date: "09-15-2024", amount: "$114.02", method: "Visa ****4242", status: "completed", confirmationNumber: "PAY-2024-0915" },
  { id: 6, date: "08-18-2024", amount: "$98.75", method: "Visa ****4242", status: "completed", confirmationNumber: "PAY-2024-0818" },
]

const paymentMethods = [
  { id: 1, type: "Visa", last4: "4242", expiry: "12/26", isDefault: true },
]

const stats = [
  { label: "Total Paid (YTD)", value: "$574.13", icon: DollarSign },
  { label: "Payments Made", value: "6", icon: CheckCircle },
  { label: "Avg. Payment", value: "$95.69", icon: Clock },
]

export default function TenantPayments() {
  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader title="Payment History" />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Payment History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{payment.date}</p>
                          <p className="text-sm text-muted-foreground">{payment.method}</p>
                          <p className="text-xs text-muted-foreground">{payment.confirmationNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{payment.amount}</p>
                        <Badge className="bg-green-500 hover:bg-green-600 text-white">
                          Completed
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Payment Methods</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentMethods.map((method) => (
                  <div 
                    key={method.id} 
                    className="p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <span className="font-medium text-foreground">{method.type} ****{method.last4}</span>
                      </div>
                      {method.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Expires {method.expiry}</p>
                  </div>
                ))}
                <Button variant="outline" className="w-full bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>

            {/* Auto-Pay */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Auto-Pay</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up automatic payments to never miss a due date.
                </p>
                <Button className="w-full">
                  Enable Auto-Pay
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
