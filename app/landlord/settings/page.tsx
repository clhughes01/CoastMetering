"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, LogOut } from "lucide-react"
import { getCurrentUser, signOut } from "@/lib/auth"
import { useRouter } from "next/navigation"
import type { User as UserType } from "@/lib/types"

const BASE = "/landlord"

export default function LandlordSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false))
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Account" basePath={BASE} />
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Account" breadcrumbs={[{ label: "Account" }]} basePath={BASE} />
      <main className="flex-1 p-4 md:p-6 max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile (read-only)
            </CardTitle>
            <CardDescription>
              Your account info. Contact your Property Manager or admin to change details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {user?.name && <p><span className="text-muted-foreground">Name:</span> {user.name}</p>}
            {user?.email && <p><span className="text-muted-foreground">Email:</span> {user.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button variant="outline" onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
