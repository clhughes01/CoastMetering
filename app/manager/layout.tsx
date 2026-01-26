import React from "react"
import { Sidebar } from "@/components/manager/sidebar"

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64 transition-all duration-300">
        {children}
      </div>
    </div>
  )
}
