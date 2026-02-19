"use client"

import { Header } from "@/components/manager/header"
import { PaymentsTab } from "@/components/payments/PaymentsTab"

export default function ManagerPaymentsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Payments" breadcrumbs={[{ label: "Payments" }]} />
      <main className="flex-1 p-4 md:p-6">
        <PaymentsTab />
      </main>
    </div>
  )
}
