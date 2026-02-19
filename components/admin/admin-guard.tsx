"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

/**
 * Renders children only if the current user is an admin. Otherwise redirects to home.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getCurrentUser().then((user) => {
      if (cancelled) return
      if (!user) {
        router.replace("/")
        return
      }
      if (user.role !== "admin") {
        if (user.role === "manager") router.replace("/manager/dashboard")
        else router.replace("/tenant/tenant.new/dashboard")
        return
      }
      setAllowed(true)
    })
    return () => {
      cancelled = true
    }
  }, [router])

  if (allowed !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    )
  }

  return <>{children}</>
}
