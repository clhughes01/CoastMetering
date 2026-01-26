"use client"

import { TenantHeader } from "@/components/tenant/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Download, CreditCard, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Statement {
  id: number
  month: string
  year: string
  startDate: string
  endDate: string
  usage: string
  amountDue: string
  dueDate: string
  status: "paid" | "pending" | "overdue"
  paidDate?: string
}

const statements: Statement[] = [
  { id: 1, month: "January", year: "2025", startDate: "01-01-2025", endDate: "01-31-2025", usage: "820 gal", amountDue: "$92.09", dueDate: "02-20-2025", status: "pending" },
  { id: 2, month: "December", year: "2024", startDate: "12-01-2024", endDate: "12-31-2024", usage: "785 gal", amountDue: "$87.50", dueDate: "01-20-2025", status: "paid", paidDate: "01-15-2025" },
  { id: 3, month: "November", year: "2024", startDate: "11-01-2024", endDate: "11-30-2024", usage: "702 gal", amountDue: "$78.22", dueDate: "12-20-2024", status: "paid", paidDate: "12-12-2024" },
  { id: 4, month: "October", year: "2024", startDate: "10-01-2024", endDate: "10-31-2024", usage: "845 gal", amountDue: "$94.10", dueDate: "11-20-2024", status: "paid", paidDate: "11-08-2024" },
  { id: 5, month: "September", year: "2024", startDate: "09-01-2024", endDate: "09-30-2024", usage: "912 gal", amountDue: "$101.54", dueDate: "10-20-2024", status: "paid", paidDate: "10-10-2024" },
  { id: 6, month: "August", year: "2024", startDate: "08-01-2024", endDate: "08-31-2024", usage: "1,024 gal", amountDue: "$114.02", dueDate: "09-20-2024", status: "paid", paidDate: "09-15-2024" },
]

const getStatusBadge = (status: Statement["status"]) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white">Paid</Badge>
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function TenantStatements() {
  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader title="My Statements" />
      
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Current Balance Card */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance Due</p>
                <p className="text-3xl font-bold text-foreground">$92.09</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Calendar className="h-4 w-4" />
                  Due by February 20, 2025
                </p>
              </div>
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Year</label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Status</label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statements List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Statement History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statements.map((statement) => (
                <div 
                  key={statement.id} 
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{statement.month} {statement.year}</h3>
                      {getStatusBadge(statement.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Period: </span>
                        <span className="text-foreground">{statement.startDate} - {statement.endDate}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Usage: </span>
                        <span className="text-foreground">{statement.usage}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due: </span>
                        <span className="text-foreground">{statement.dueDate}</span>
                      </div>
                      {statement.paidDate && (
                        <div>
                          <span className="text-muted-foreground">Paid: </span>
                          <span className="text-foreground">{statement.paidDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{statement.amountDue}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      {statement.status === "pending" && (
                        <Button size="sm">
                          Pay
                        </Button>
                      )}
                    </div>
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
