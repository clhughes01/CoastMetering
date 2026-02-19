import React from "react"
import { Sidebar } from "@/components/admin/sidebar"
import { AdminGuard } from "@/components/admin/admin-guard"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:pl-64 transition-all duration-300">
          {children}
        </div>
      </div>
    </AdminGuard>
  )
}
