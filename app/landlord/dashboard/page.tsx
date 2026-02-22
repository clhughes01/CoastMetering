"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, FileText, Building2, CreditCard } from "lucide-react"
import Link from "next/link"
import { createSupabaseClient } from "@/lib/supabase/client"

const BASE = "/landlord"

export default function LandlordDashboardPage() {
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null)
  const [tenantsCount, setTenantsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createSupabaseClient()
        const { count: propsCount } = await supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
        setPropertiesCount(propsCount ?? 0)
        const { count: tenCount } = await supabase
          .from("tenants")
          .select("id", { count: "exact", head: true })
        setTenantsCount(tenCount ?? 0)
      } catch {
        setPropertiesCount(null)
        setTenantsCount(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = [
    {
      title: "Properties",
      value: propertiesCount !== null ? propertiesCount.toString() : "—",
      change: "View properties",
      icon: Building2,
      href: `${BASE}/properties`,
    },
    {
      title: "Tenants",
      value: tenantsCount !== null ? tenantsCount.toString() : "—",
      change: "View tenants",
      icon: Users,
      href: `${BASE}/tenants`,
    },
    {
      title: "Statements",
      value: "—",
      change: "View statements",
      icon: FileText,
      href: `${BASE}/statements`,
    },
    {
      title: "Payments",
      value: "—",
      change: "View payments",
      icon: CreditCard,
      href: `${BASE}/payments`,
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Dashboard" basePath={BASE} />
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" breadcrumbs={[{ label: "Dashboard" }]} basePath={BASE} />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <p className="text-muted-foreground">
          View-only portal. Your Property Manager or admin assigns properties to you; you can view those properties and their tenants here.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <Button variant="link" className="px-0 mt-1" asChild>
                  <Link href={stat.href}>{stat.change}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
