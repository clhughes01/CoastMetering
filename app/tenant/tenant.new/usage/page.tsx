"use client"

import { TenantHeader } from "@/components/tenant/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Droplets, TrendingDown, TrendingUp, BarChart3 } from "lucide-react"

const monthlyUsage = [
  { month: "Jan", year: "2025", usage: 820, cost: 92.09 },
  { month: "Dec", year: "2024", usage: 785, cost: 87.50 },
  { month: "Nov", year: "2024", usage: 702, cost: 78.22 },
  { month: "Oct", year: "2024", usage: 845, cost: 94.10 },
  { month: "Sep", year: "2024", usage: 912, cost: 101.54 },
  { month: "Aug", year: "2024", usage: 1024, cost: 114.02 },
  { month: "Jul", year: "2024", usage: 1156, cost: 128.72 },
  { month: "Jun", year: "2024", usage: 1089, cost: 121.26 },
  { month: "May", year: "2024", usage: 923, cost: 102.78 },
  { month: "Apr", year: "2024", usage: 756, cost: 84.17 },
  { month: "Mar", year: "2024", usage: 698, cost: 77.73 },
  { month: "Feb", year: "2024", usage: 654, cost: 72.83 },
]

const stats = {
  currentMonth: 820,
  lastMonth: 785,
  avgUsage: 847,
  totalYTD: 10364,
}

export default function TenantUsage() {
  const maxUsage = Math.max(...monthlyUsage.map(d => d.usage))
  const change = ((stats.currentMonth - stats.lastMonth) / stats.lastMonth * 100).toFixed(1)
  const isIncrease = stats.currentMonth > stats.lastMonth

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader title="Usage History" />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold text-foreground">{stats.currentMonth} gal</p>
                  <p className={`text-xs flex items-center gap-1 ${isIncrease ? "text-orange-500" : "text-green-500"}`}>
                    {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isIncrease ? "+" : ""}{change}% from last month
                  </p>
                </div>
                <Droplets className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Last Month</p>
              <p className="text-2xl font-bold text-foreground">{stats.lastMonth} gal</p>
              <p className="text-xs text-muted-foreground">December 2024</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">12-Month Average</p>
              <p className="text-2xl font-bold text-foreground">{stats.avgUsage} gal</p>
              <p className="text-xs text-muted-foreground">Per month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total (YTD)</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalYTD.toLocaleString()} gal</p>
              <p className="text-xs text-muted-foreground">2024 total</p>
            </CardContent>
          </Card>
        </div>

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
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Monthly Water Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <div className="flex items-end justify-between h-56 gap-1 md:gap-2 px-2">
                {monthlyUsage.slice().reverse().map((data) => (
                  <div key={`${data.month}-${data.year}`} className="flex flex-col items-center flex-1">
                    <span className="text-xs text-muted-foreground mb-1 hidden md:block">{data.usage}</span>
                    <div 
                      className="w-full bg-primary rounded-t-sm transition-all hover:bg-primary/80 cursor-pointer"
                      style={{ height: `${(data.usage / maxUsage) * 100}%` }}
                      title={`${data.usage} gallons - $${data.cost}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-2 mt-2 overflow-x-auto">
                {monthlyUsage.slice().reverse().map((data) => (
                  <span key={`label-${data.month}-${data.year}`} className="text-xs text-muted-foreground flex-1 text-center">
                    {data.month}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Usage History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Month</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Usage (gal)</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Cost</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyUsage.map((data, index) => {
                    const prevUsage = monthlyUsage[index + 1]?.usage
                    const changePercent = prevUsage ? ((data.usage - prevUsage) / prevUsage * 100).toFixed(1) : null
                    const isUp = prevUsage ? data.usage > prevUsage : false
                    
                    return (
                      <tr key={`${data.month}-${data.year}`} className="border-b border-border hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm text-foreground">{data.month} {data.year}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{data.usage.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-foreground">${data.cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">
                          {changePercent !== null ? (
                            <span className={`flex items-center gap-1 ${isUp ? "text-orange-500" : "text-green-500"}`}>
                              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isUp ? "+" : ""}{changePercent}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Water Saving Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                Fix leaky faucets promptly - a dripping faucet can waste 20 gallons per day
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                Take shorter showers - reducing shower time by 2 minutes saves up to 10 gallons
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                Run dishwashers and washing machines with full loads only
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                Turn off the tap while brushing teeth or shaving
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
