"use client"

import { Header } from "@/components/manager/header"
import { Card, CardContent } from "@/components/ui/card"
import { Receipt } from "lucide-react"
import { LandlordViewFilter } from "@/components/landlord/landlord-view-filter"

const BASE = "/landlord"

export default function LandlordUtilityBillsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Utility Bills" breadcrumbs={[{ label: "Utility Bills" }]} basePath={BASE} />
      <LandlordViewFilter />
      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Utility bills for your properties (read-only). See Payments for billing and payment details.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
