"use client"

import { Header } from "@/components/manager/header"
import { Card, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"
import { LandlordViewFilter } from "@/components/landlord/landlord-view-filter"

const BASE = "/landlord"

export default function LandlordStatementsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Statements" breadcrumbs={[{ label: "Statements" }]} basePath={BASE} />
      <LandlordViewFilter />
      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Statement history for your properties. Use Payments to see bill and payment details.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
