"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Filter } from "lucide-react"
import { useState, useEffect, useMemo } from "react"

type PropertyOption = { id: string; address: string | null; label: string }

export function LandlordViewFilter() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const propertyId = searchParams.get("property") || ""

  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/properties/list")
        if (!res.ok) return
        const json = await res.json()
        const data = json.data || []
        setProperties(
          data.map((p: { id: string; address: string | null; city: string | null; state: string | null; zip_code: string | null }) => ({
            id: p.id,
            address: p.address,
            label: [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean).join(", ") || p.id,
          }))
        )
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const effectivePropertyId = useMemo(() => {
    if (!propertyId) return ""
    const exists = properties.some((p) => p.id === propertyId)
    return exists ? propertyId : ""
  }, [propertyId, properties])

  useEffect(() => {
    if (propertyId && !effectivePropertyId) {
      const next = new URLSearchParams(searchParams.toString())
      next.delete("property")
      router.replace(pathname + (next.toString() ? `?${next}` : ""))
    }
  }, [propertyId, effectivePropertyId, pathname, router, searchParams])

  const updateUrl = (value: string | null) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set("property", value)
    else next.delete("property")
    const q = next.toString()
    router.push(pathname + (q ? `?${q}` : ""))
  }

  if (loading || properties.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-muted/40 border-b border-border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filter by property</span>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="landlord-filter-property" className="text-xs text-muted-foreground whitespace-nowrap">
          Property
        </Label>
        <Select
          value={effectivePropertyId || "all"}
          onValueChange={(v) => updateUrl(v === "all" ? null : v)}
        >
          <SelectTrigger id="landlord-filter-property" className="w-[220px]" size="sm">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
