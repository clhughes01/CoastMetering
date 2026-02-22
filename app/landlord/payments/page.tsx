"use client"

import { Header } from "@/components/manager/header"
import { LandlordViewFilter } from "@/components/landlord/landlord-view-filter"
import { PaymentsTab } from "@/components/payments/PaymentsTab"

const BASE = "/landlord"

export default function LandlordPaymentsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Payments" breadcrumbs={[{ label: "Payments" }]} basePath={BASE} />
      <LandlordViewFilter />
      <main className="flex-1 p-4 md:p-6">
        <PaymentsTab />
      </main>
    </div>
  )
}
