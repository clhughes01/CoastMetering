"use client"

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { BarChart3, TrendingUp, Droplets, Calendar, Search } from "lucide-react"
import { getConsumptionData, getCustomers } from "@/lib/data"
import type { ConsumptionData } from "@/lib/types"

const BASE = "/admin"

interface PropertyOption {
  id: string
  address: string
  city: string
  state: string
  zip_code: string
  label: string
}

const topConsumersPlaceholder = [
  { unit: "Unit 1160", name: "—", consumption: "—", cost: "—" },
  { unit: "Unit 1037", name: "—", consumption: "—", cost: "—" },
  { unit: "Unit 1130", name: "—", consumption: "—", cost: "—" },
]

export default function AdminConsumptionPage() {
  const [data, setData] = useState<ConsumptionData[]>([])
  const [loading, setLoading] = useState(true)
  const [customerCount, setCustomerCount] = useState(0)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [propertySearch, setPropertySearch] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null)
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false)
  const propertySearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await fetch("/api/properties/list")
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setProperties(
            json.data.map(
              (p: {
                id: string
                address: string
                city: string
                state: string
                zip_code: string
              }) => ({
                ...p,
                label: `${p.address}, ${p.city}, ${p.state} ${p.zip_code}`,
              })
            )
          )
        }
      } catch (err) {
        console.error("Error loading properties:", err)
      }
    }
    loadProperties()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        propertySearchRef.current &&
        !propertySearchRef.current.contains(event.target as Node)
      ) {
        setPropertyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [consumption, customers] = await Promise.all([
          getConsumptionData(),
          getCustomers(),
        ])
        setData(consumption)
        setCustomerCount(customers.length)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const propertySearchLower = propertySearch.trim().toLowerCase()
  const matchingProperties = propertySearchLower
    ? properties.filter(
        (p) =>
          p.address.toLowerCase().includes(propertySearchLower) ||
          p.city.toLowerCase().includes(propertySearchLower) ||
          p.state.toLowerCase().includes(propertySearchLower) ||
          p.zip_code.toLowerCase().includes(propertySearchLower) ||
          p.label.toLowerCase().includes(propertySearchLower)
      )
    : properties
  const showDropdown =
    propertyDropdownOpen &&
    (propertySearch.length > 0 || matchingProperties.length > 0)

  const maxConsumption = data.length ? Math.max(...data.map((d) => d.consumption)) : 1
  const totalConsumption = data.reduce((sum, d) => sum + d.consumption, 0)
  const avgMonthly = data.length ? Math.round(totalConsumption / data.length) : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Consumption"
        breadcrumbs={[{ label: "Consumption" }]}
        basePath={BASE}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Year
                </label>
                <Select defaultValue="2025">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-64" ref={propertySearchRef}>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Property
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search properties..."
                    value={
                      propertySearch ||
                      (selectedProperty ? selectedProperty.label : "")
                    }
                    onChange={(e) => {
                      setPropertySearch(e.target.value)
                      setSelectedProperty(null)
                      setPropertyDropdownOpen(true)
                    }}
                    onFocus={() => setPropertyDropdownOpen(true)}
                    className="pl-9"
                  />
                </div>
                {showDropdown && (
                  <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card py-1 shadow-lg max-h-60 overflow-auto">
                    <li>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                        onClick={() => {
                          setSelectedProperty(null)
                          setPropertySearch("")
                          setPropertyDropdownOpen(false)
                        }}
                      >
                        All properties
                      </button>
                    </li>
                    {matchingProperties.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        No matching properties
                      </li>
                    ) : (
                      matchingProperties.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                            onClick={() => {
                              setSelectedProperty(p)
                              setPropertySearch("")
                              setPropertyDropdownOpen(false)
                            }}
                          >
                            {p.label}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Droplets className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? "—" : totalConsumption.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total (from meter readings)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {avgMonthly.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Avg. Monthly (gal)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? "—" : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Cost (when billing linked)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? "—" : customerCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Tenants
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Monthly Water Consumption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {loading ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Loading...
                </div>
              ) : data.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                  <p className="font-medium text-foreground">
                    No consumption data yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add meters and ingest readings (Badger Orion or manual) to
                    see data here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between h-64 gap-2 px-4">
                    {data.map((item) => (
                      <div
                        key={`${item.month}-${item.year ?? ""}`}
                        className="flex flex-col items-center flex-1"
                      >
                        <div
                          className="w-full bg-primary rounded-t-sm transition-all hover:bg-primary/80"
                          style={{
                            height: `${(item.consumption / maxConsumption) * 100}%`,
                          }}
                          title={`${item.consumption.toLocaleString()}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between px-4 mt-2">
                    {data.map((item) => (
                      <span
                        key={`${item.month}-${item.year ?? ""}`}
                        className="text-xs text-muted-foreground flex-1 text-center"
                      >
                        {item.month}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span className="text-sm text-muted-foreground">
                  Water Consumption (gallons)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Water Consumers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topConsumersPlaceholder.map((consumer, index) => (
                <div
                  key={consumer.unit}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">
                        {consumer.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {consumer.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {consumer.consumption}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {consumer.cost}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
