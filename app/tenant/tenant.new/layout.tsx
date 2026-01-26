import React from "react"
import { TenantSidebar } from "@/components/tenant/sidebar"

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <TenantSidebar />
      <div className="lg:pl-64 transition-all duration-300">
        {children}
      </div>
    </div>
  )
}
