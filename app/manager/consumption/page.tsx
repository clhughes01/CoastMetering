"use client"

import { Header } from "@/components/manager/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, TrendingUp, Droplets, Calendar } from "lucide-react"
import { consumptionData, customers } from "@/lib/data"

// Top consumers data - in production this would come from database query
const topConsumers = [
  { unit: "Unit 1160", name: "German Lopez Ramirez", consumption: "2,450 gal", cost: "$285.56" },
  { unit: "Unit 1037", name: "Mario Domingo", consumption: "1,890 gal", cost: "$194.50" },
  { unit: "Unit 1130", name: "Alejandro Juan Domingo", consumption: "1,540 gal", cost: "$178.43" },
  { unit: "Unit 220", name: "Miguel Gonzales Rubio", consumption: "1,180 gal", cost: "$134.80" },
  { unit: "Unit 214", name: "Rosalia Martinez", consumption: "820 gal", cost: "$92.09" },
]

export default function ConsumptionPage() {
  // TODO: Replace with server component or SWR data fetching
  // Example: const { data: consumptionData } = useSWR('/api/consumption', fetcher)
  const data = consumptionData
  
  const maxConsumption = Math.max(...data.map(d => d.consumption))
  const totalConsumption = data.reduce((sum, d) => sum + d.consumption, 0)
  const avgMonthly = Math.round(totalConsumption / data.length)

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        title="Dashboard" 
        breadcrumbs={[{ label: "Consumption Chart" }]} 
      />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Year</label>
                <Select defaultValue="2024">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Property</label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    <SelectItem value="beech">214 South Beech Street</SelectItem>
                    <SelectItem value="grand">1160 East Grand Avenue</SelectItem>
                    <SelectItem value="amherst">6836 Amherst Street</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Droplets className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalConsumption.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Gallons (YTD)</p>
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
                  <p className="text-2xl font-bold text-foreground">{avgMonthly.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Avg. Monthly (gal)</p>
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
                  <p className="text-2xl font-bold text-foreground">$89,300</p>
                  <p className="text-sm text-muted-foreground">Total Cost (YTD)</p>
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
                  <p className="text-2xl font-bold text-foreground">{customers.length}</p>
                  <p className="text-sm text-muted-foreground">Active Meters</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Monthly Water Consumption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <div className="flex items-end justify-between h-64 gap-2 px-4">
                {data.map((item) => (
                  <div key={item.month} className="flex flex-col items-center flex-1">
                    <div 
                      className="w-full bg-primary rounded-t-sm transition-all hover:bg-primary/80"
                      style={{ height: `${(item.consumption / maxConsumption) * 100}%` }}
                      title={`${item.consumption.toLocaleString()} gallons`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-4 mt-2">
                {data.map((item) => (
                  <span key={item.month} className="text-xs text-muted-foreground flex-1 text-center">
                    {item.month}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span className="text-sm text-muted-foreground">Water Consumption (gallons)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Consumers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Water Consumers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topConsumers.map((consumer, index) => (
                <div key={consumer.unit} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{consumer.unit}</p>
                      <p className="text-sm text-muted-foreground">{consumer.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{consumer.consumption}</p>
                    <p className="text-sm text-muted-foreground">{consumer.cost}</p>
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
