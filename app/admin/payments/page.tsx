"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/manager/header"
import { PaymentsTab } from "@/components/payments/PaymentsTab"
import { Loader2 } from "lucide-react"

const BASE = "/admin"

function PaymentsContent() {
  const searchParams = useSearchParams()
  const managerId = searchParams.get("manager") || undefined
  const propertyId = searchParams.get("property") || undefined

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Payments"
        breadcrumbs={[{ label: "Payments" }]}
        basePath={BASE}
      />
      <main className="flex-1 p-4 md:p-6">
        <PaymentsTab managerId={managerId} propertyId={propertyId} />
      </main>
    </div>
  )
}

function PaymentsFallback() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Payments" breadcrumbs={[{ label: "Payments" }]} basePath={BASE} />
      <main className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    </div>
  )
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<PaymentsFallback />}>
      <PaymentsContent />
    </Suspense>
  )
}
