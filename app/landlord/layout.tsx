import React, { Suspense } from "react"
import { Sidebar } from "@/components/landlord/sidebar"

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="w-64 min-h-screen bg-muted/30 animate-pulse" />}>
        <Sidebar />
      </Suspense>
      <div className="lg:pl-64 transition-all duration-300">
        <Suspense fallback={<div className="p-6 animate-pulse">Loading...</div>}>
          {children}
        </Suspense>
      </div>
    </div>
  )
}
