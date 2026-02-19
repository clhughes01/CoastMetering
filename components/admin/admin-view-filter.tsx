"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Filter } from "lucide-react"
import { useState, useEffect, useMemo } from "react"

type Manager = { id: string; name: string | null; email: string }
type PropertyOption = { id: string; address: string | null; label: string }
type ManagerWithProperties = { id: string; name: string | null; email: string; properties: PropertyOption[] }

export function AdminViewFilter() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const managerId = searchParams.get("manager") || ""
  const propertyId = searchParams.get("property") || ""

  const [managersWithProperties, setManagersWithProperties] = useState<ManagerWithProperties[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(isRefresh = false) {
      try {
        if (!isRefresh) setLoading(true)
        const res = await fetch("/api/admin/property-managers")
        if (!res.ok) return
        const json = await res.json()
        const data = json.data || []
        setManagersWithProperties(
          data.map((m: { id: string; name: string | null; email: string; properties?: Array<{ id: string; address: string | null; city: string | null; state: string | null; zip_code: string | null }> }) => {
            const propsList: PropertyOption[] = (m.properties || []).map((p: { id: string; address: string | null; city: string | null; state: string | null; zip_code: string | null }) => ({
              id: p.id,
              address: p.address,
              label: [p.address, [p.city, p.state, p.zip_code].filter(Boolean).join(", ")].filter(Boolean).join(", ") || p.id,
            }))
            return {
              id: m.id,
              name: m.name,
              email: m.email,
              properties: propsList,
            }
          })
        )
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()

    const onRefresh = () => load(true)
    window.addEventListener("admin-filter-refresh", onRefresh)
    return () => window.removeEventListener("admin-filter-refresh", onRefresh)
  }, [])

  const managers = useMemo(
    () => managersWithProperties.map((m) => ({ id: m.id, name: m.name, email: m.email })),
    [managersWithProperties]
  )

  const propertiesForDropdown = useMemo(() => {
    if (managerId) {
      const manager = managersWithProperties.find((m) => m.id === managerId)
      return manager ? manager.properties : []
    }
    return managersWithProperties.flatMap((m) => m.properties)
  }, [managersWithProperties, managerId])

  const effectivePropertyId = useMemo(() => {
    if (!propertyId) return ""
    const exists = propertiesForDropdown.some((p) => p.id === propertyId)
    return exists ? propertyId : ""
  }, [propertyId, propertiesForDropdown])

  useEffect(() => {
    if (propertyId && !effectivePropertyId) {
      const next = new URLSearchParams(searchParams.toString())
      next.delete("property")
      const q = next.toString()
      router.replace(pathname + (q ? `?${q}` : ""))
    }
  }, [propertyId, effectivePropertyId, pathname, router, searchParams])

  const updateUrl = (updates: { manager?: string | null; property?: string | null }) => {
    const next = new URLSearchParams(searchParams.toString())
    if (updates.manager !== undefined) {
      if (updates.manager) next.set("manager", updates.manager)
      else next.delete("manager")
      next.delete("property")
    }
    if (updates.property !== undefined) {
      if (updates.property) next.set("property", updates.property)
      else next.delete("property")
    }
    const q = next.toString()
    router.push(pathname + (q ? `?${q}` : ""))
  }

  if (loading) return null

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-muted/40 border-b border-border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">View by</span>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="admin-filter-manager" className="text-xs text-muted-foreground whitespace-nowrap">
          Manager
        </Label>
        <Select
          value={managerId || "all"}
          onValueChange={(v) => updateUrl({ manager: v === "all" ? null : v })}
        >
          <SelectTrigger id="admin-filter-manager" className="w-[200px]" size="sm">
            <SelectValue placeholder="All managers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All managers</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="admin-filter-property" className="text-xs text-muted-foreground whitespace-nowrap">
          Property
        </Label>
        <Select
          value={effectivePropertyId || "all"}
          onValueChange={(v) => updateUrl({ property: v === "all" ? null : v })}
        >
          <SelectTrigger id="admin-filter-property" className="w-[220px]" size="sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {propertiesForDropdown.map((p) => (
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
