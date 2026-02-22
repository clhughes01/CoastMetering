"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, DollarSign, Building, TrendingUp } from "lucide-react"
import Link from "next/link"
import { getCustomers, getStatements, getPayments } from "@/lib/data"
import { createSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Droplets } from "lucide-react"
import { adminPathWithFilter } from "@/lib/admin-filter"

const BASE = "/admin"

/** Placeholder: fee % Coast Metering takes from revenue (e.g. 5%). Replace with config/settings later. */
const COAST_METERING_FEE_PERCENT = 5

export default function AdminDashboardPage() {
  const searchParams = useSearchParams()
  const managerId = searchParams.get("manager") || undefined
  const propertyId = searchParams.get("property") || undefined
  const linkParams = { manager: managerId ?? null, property: propertyId ?? null }

  const [customers, setCustomers] = useState<any[]>([])
  const [statements, setStatements] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; manager_id: string | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseClient()
      const [customersData, statementsData, paymentsData, propsRes] = await Promise.all([
        getCustomers(),
        getStatements(),
        getPayments(),
        supabase.from("properties").select("id, manager_id"),
      ])
      setCustomers(customersData)
      setStatements(statementsData)
      setPayments(paymentsData)
      setProperties(propsRes.data || [])
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      setCustomers([])
      setStatements([])
      setPayments([])
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const filteredPropertyIds = useMemo(() => {
    let ids = new Set(properties.map((p) => p.id))
    if (managerId) {
      ids = new Set(properties.filter((p) => p.manager_id === managerId).map((p) => p.id))
    }
    if (propertyId && ids.has(propertyId)) {
      ids = new Set([propertyId])
    } else if (propertyId) {
      ids = new Set()
    }
    return ids
  }, [properties, managerId, propertyId])

  const filteredCustomers = useMemo(() => {
    if (filteredPropertyIds.size === 0 && (managerId || propertyId)) return []
    if (!managerId && !propertyId) return customers
    return customers.filter((c: any) => c.propertyId && filteredPropertyIds.has(c.propertyId))
  }, [customers, filteredPropertyIds, managerId, propertyId])

  const filteredStatements = useMemo(() => {
    if (filteredPropertyIds.size === 0 && (managerId || propertyId)) return []
    if (!managerId && !propertyId) return statements
    return statements.filter((s: any) => s.propertyId && filteredPropertyIds.has(s.propertyId))
  }, [statements, filteredPropertyIds, managerId, propertyId])

  const accountNumbersInScope = useMemo(
    () => new Set(filteredCustomers.map((c: any) => c.accountNumber)),
    [filteredCustomers]
  )

  const filteredPayments = useMemo(() => {
    if (filteredPropertyIds.size === 0 && (managerId || propertyId)) return []
    if (!managerId && !propertyId) return payments
    return payments.filter((p: any) => accountNumbersInScope.has(p.accountNumber))
  }, [payments, accountNumbersInScope, managerId, propertyId])

  const propertiesCount = filteredPropertyIds.size
  const pendingStatements = filteredStatements.filter((s: any) => s.status === "pending").length
  const successfulPayments = filteredPayments.filter((p: any) => p.status === "succeeded")
  const totalRevenue = successfulPayments.reduce((sum, p) => {
    const amount = Number.parseFloat(String(p.totalAmount).replace(/[$,]/g, ""))
    return sum + amount
  }, 0)
  const coastMeteringProfit = (totalRevenue * COAST_METERING_FEE_PERCENT) / 100

  const stats = [
    { title: "Total Tenants", value: filteredCustomers.length.toString(), change: "In filtered view", icon: Users, href: adminPathWithFilter(`${BASE}/customers`, linkParams) },
    { title: "Active Properties", value: propertiesCount.toString(), change: "In filtered view", icon: Building, href: adminPathWithFilter(`${BASE}/properties`, linkParams) },
    { title: "Pending Statements", value: pendingStatements.toString(), change: pendingStatements > 0 ? "Due soon" : "All caught up", icon: FileText, href: adminPathWithFilter(`${BASE}/statements`, linkParams) },
    { title: "Monthly Revenue", value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, change: "From payments", icon: DollarSign, href: adminPathWithFilter(`${BASE}/payments`, linkParams) },
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
        <Header title="Dashboard" basePath={BASE} />
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" breadcrumbs={[{ label: "Dashboard" }]} basePath={BASE} />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <stat.icon className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Coast Metering profit (based on fees) — placeholder until fee structure is configured */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Coast Metering profit
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Estimated from fees on revenue. Fee structure can be configured in Settings when available.
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${coastMeteringProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {COAST_METERING_FEE_PERCENT}% of monthly revenue (placeholder rate)
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
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
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <p className="text-sm text-muted-foreground">Shortcuts to common tasks</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={adminPathWithFilter(`${BASE}/customers`, linkParams)}>Add Tenant</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={adminPathWithFilter(`${BASE}/statements`, linkParams)}>Statements</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={adminPathWithFilter(`${BASE}/utility-bills`, linkParams)}>Utility Bills</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={adminPathWithFilter(`${BASE}/textract-test`, linkParams)}>Extract Bill (Textract)</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={adminPathWithFilter(`${BASE}/payments`, linkParams)}>Payments</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={adminPathWithFilter(`${BASE}/property-managers`, linkParams)}>Property Managers</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
