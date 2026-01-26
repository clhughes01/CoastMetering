"use client"

import { TenantHeader } from "@/components/tenant/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Droplets, Calendar, FileText, CreditCard, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getCurrentUser } from "@/lib/auth"
import type { User } from "@/lib/types"

const accountInfo = {
  accountNumber: "1005",
  unit: "Unit 214",
  address: "214 South Beech Street, Escondido, CA 92025",
  currentBalance: "$92.09",
  dueDate: "February 20, 2025",
  lastPayment: "$87.50",
  lastPaymentDate: "January 15, 2025",
}

const recentStatements = [
  { month: "January 2025", amount: "$92.09", status: "pending", dueDate: "02-20-2025" },
  { month: "December 2024", amount: "$87.50", status: "paid", dueDate: "01-20-2025" },
  { month: "November 2024", amount: "$78.22", status: "paid", dueDate: "12-20-2024" },
]

export default function TenantDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setLoading(false)
    }
    loadUser()
  }, [])

  const getUserName = () => {
    if (user?.name) return user.name
    if (user?.email) return user.email.split("@")[0]
    return "User"
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader title={`Welcome Back, ${loading ? "..." : getUserName()}`} />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Account Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold text-foreground">{accountInfo.currentBalance}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-xl font-semibold text-foreground">{accountInfo.dueDate}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Last Payment</p>
                  <p className="text-xl font-semibold text-foreground">{accountInfo.lastPayment}</p>
                  <p className="text-xs text-muted-foreground">{accountInfo.lastPaymentDate}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month Usage</p>
                  <p className="text-xl font-semibold text-foreground">820 gal</p>
                  <p className="text-xs text-green-600">-5% from last month</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Droplets className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Statements */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/tenant/statements" className="block">
                <Button variant="outline" className="w-full justify-between h-12 bg-transparent">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    View Current Statement
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button className="w-full justify-between h-12 bg-primary hover:bg-primary/90">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pay Now - {accountInfo.currentBalance}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link href="/tenant/usage" className="block">
                <Button variant="outline" className="w-full justify-between h-12 bg-transparent">
                  <span className="flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    View Usage History
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Statements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Statements</CardTitle>
              <Link href="/tenant/statements" className="text-sm text-primary hover:underline">
                View All
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentStatements.map((statement) => (
                  <div key={statement.month} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{statement.month}</p>
                      <p className="text-sm text-muted-foreground">Due: {statement.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{statement.amount}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        statement.status === "paid" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {statement.status === "paid" ? "Paid" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Account Holder</p>
                <p className="font-medium text-foreground">{loading ? "Loading..." : getUserName()}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium text-foreground">{accountInfo.accountNumber}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Unit</p>
                <p className="font-medium text-foreground">{accountInfo.unit}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Service Address</p>
                <p className="font-medium text-foreground text-sm">{accountInfo.address}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
