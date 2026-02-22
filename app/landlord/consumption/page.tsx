"use client"

import { Header } from "@/components/manager/header"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { LandlordViewFilter } from "@/components/landlord/landlord-view-filter"

const BASE = "/landlord"

export default function LandlordConsumptionPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Consumption" breadcrumbs={[{ label: "Consumption" }]} basePath={BASE} />
      <LandlordViewFilter />
      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Consumption data for your properties (read-only). Contact your Property Manager for details.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
