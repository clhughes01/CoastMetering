"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Loader2 } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

type PropertyRow = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

function formatAddress(p: PropertyRow): string {
  const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
  return parts.length ? parts.join(", ") : p.id
}

export default function ManagerAssignPropertiesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingPropertyId, setUpdatingPropertyId] = useState<string | null>(null)

  const loadUser = useCallback(async () => {
    const user = await getCurrentUser()
    if (user) setUserId(user.id)
    else setLoading(false)
  }, [])

  const fetchProperties = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/manager/unassigned-properties")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load unassigned properties")
      }
      const json = await res.json()
      setProperties(json.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useEffect(() => {
    if (userId != null) fetchProperties()
  }, [userId, fetchProperties])

  const assignToMe = async (propertyId: string) => {
    if (!userId) return
    setUpdatingPropertyId(propertyId)
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/manager`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to assign")
      await fetchProperties()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign")
    } finally {
      setUpdatingPropertyId(null)
    }
  }

  return (
    <>
      <Header title="Assign properties" basePath="/manager" />
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Unassigned properties
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              You can assign unassigned properties to yourself. After assigning, they will appear under your Properties.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unassigned properties.</p>
            ) : (
              <ul className="space-y-3">
                {properties.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground min-w-0 flex-1">
                      {formatAddress(p)}
                    </span>
                    <Button
                      size="sm"
                      disabled={updatingPropertyId === p.id}
                      onClick={() => assignToMe(p.id)}
                    >
                      {updatingPropertyId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Assign to me"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
