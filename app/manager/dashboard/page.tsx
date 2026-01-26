"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, DollarSign, TrendingUp, Droplets, Building } from "lucide-react"
import Link from "next/link"
import { getCustomers, getStatements, getPayments } from "@/lib/data"

export default function DashboardPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [statements, setStatements] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [customersData, statementsData, paymentsData] = await Promise.all([
        getCustomers(),
        getStatements(),
        getPayments(),
      ])
      setCustomers(customersData)
      setStatements(statementsData)
      setPayments(paymentsData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      // Use mock data as fallback
      setCustomers([])
      setStatements([])
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  const pendingStatements = statements.filter((s: any) => s.status === "pending").length
  const successfulPayments = payments.filter((p: any) => p.status === "succeeded")
  const totalRevenue = successfulPayments.reduce((sum, p) => {
    const amount = Number.parseFloat(p.totalAmount.replace(/[$,]/g, ''))
    return sum + amount
  }, 0)

  const stats = [
    {
      title: "Total Customers",
      value: customers.length.toString(),
      change: "+12 this month",
      icon: Users,
      href: "/manager/customers"
    },
    {
      title: "Active Properties",
      value: "24",
      change: "4 new units",
      icon: Building,
      href: "/manager/customers"
    },
    {
      title: "Pending Statements",
      value: pendingStatements.toString(),
      change: "Due this week",
      icon: FileText,
      href: "/manager/statements"
    },
    {
      title: "Monthly Revenue",
      value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      change: "+8.2% from last month",
      icon: DollarSign,
      href: "/manager/payments"
    },
  ]

const recentActivity = [
  { id: 1, action: "Payment received", customer: "Rosalia Martinez", amount: "$92.09", time: "2 hours ago" },
  { id: 2, action: "New statement generated", customer: "Miguel Gonzales", amount: "$134.80", time: "4 hours ago" },
  { id: 3, action: "Payment received", customer: "German Lopez", amount: "$285.56", time: "5 hours ago" },
  { id: 4, action: "Account created", customer: "Jesus Ramirez", amount: "-", time: "1 day ago" },
  { id: 5, action: "Payment received", customer: "Alejandro Domingo", amount: "$178.43", time: "1 day ago" },
]

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Dashboard" />
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    {stat.change}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.customer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{activity.amount}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Water Consumption Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" />
                Water Consumption Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Usage (Jan)</span>
                  <span className="text-sm font-medium">124,500 gallons</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: "72%" }} />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">72%</p>
                    <p className="text-xs text-muted-foreground">Capacity Used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">156</p>
                    <p className="text-xs text-muted-foreground">Active Meters</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">3</p>
                    <p className="text-xs text-muted-foreground">Alerts</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/manager/customers">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                  Add New Customer
                </button>
              </Link>
              <Link href="/manager/statements">
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors">
                  Generate Statements
                </button>
              </Link>
              <Link href="/manager/utility-bills">
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors">
                  View Utility Bills
                </button>
              </Link>
              <Link href="/manager/payments">
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors">
                  Process Payments
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
