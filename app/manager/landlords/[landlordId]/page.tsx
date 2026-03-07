"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, ChevronLeft, Mail, Phone, Users } from "lucide-react"

const BASE = "/manager"

type PropertyRow = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

type LandlordDetail = {
  id: string
  email: string
  name: string | null
  phone: string | null
  properties: PropertyRow[]
}

type ApiResponse = {
  success: boolean
  data: LandlordDetail[]
}

export default function ManagerLandlordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const landlordId = params?.landlordId as string
  const [landlord, setLandlord] = useState<LandlordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!landlordId) return
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/admin/landlords")
        if (!res.ok) throw new Error("Failed to load")
        const json: ApiResponse = await res.json()
        const found = (json.data || []).find((l) => l.id === landlordId)
        if (!found) throw new Error("Landlord not found")
        setLandlord(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Landlord not found.")
        setLandlord(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [landlordId])

  const formatAddress = (p: PropertyRow) => {
    const parts = [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
  }

  const displayName = landlord ? (landlord.name || landlord.email) : "…"

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title={displayName}
        breadcrumbs={[
          { label: "Landlords", href: `${BASE}/landlords` },
          { label: displayName },
        ]}
        basePath={BASE}
      />
      <main className="flex-1 p-4 md:p-6">
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => router.push(`${BASE}/landlords`)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to landlords
        </Button>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : error || !landlord ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">{error ?? "Landlord not found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {landlord.name || landlord.email}
              </CardTitle>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {landlord.email}
                </span>
                {landlord.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {landlord.phone}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-foreground mb-2">
                Properties ({landlord.properties.length})
              </p>
              {landlord.properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {landlord.properties.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Link
                        href={`${BASE}/properties/${p.id}`}
                        className="text-primary hover:underline min-w-0"
                      >
                        {formatAddress(p)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
